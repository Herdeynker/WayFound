import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PassportState } from "@/features/passport/model";
import { emptyPassportState, passportStateSchema, normalizeSkillName } from "@/features/passport/model";
import { calculateCompletion, findContradictions } from "./completion";
import type { Database, Json } from "@/server/supabase/database.types";

type Client = SupabaseClient<Database, "public">;

export async function getPassportDraft(client: Client, userId: string) {
  const { data, error } = await client
    .from("onboarding_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("We could not load your Passport draft.");
  const parsed = data ? passportStateSchema.safeParse(data.draft) : null;
  const state = parsed?.success ? parsed.data : emptyPassportState;
  return {
    state,
    progress: data,
    completion: calculateCompletion(state),
    contradictions: findContradictions(state),
  };
}

export async function savePassportDraft(
  client: Client,
  userId: string,
  state: PassportState,
  currentSection: string,
) {
  const completion = calculateCompletion(state);
  const { data: previous } = await client
    .from("onboarding_progress")
    .select("revision")
    .eq("user_id", userId)
    .maybeSingle();
  const { error } = await client.from("onboarding_progress").upsert(
    {
      user_id: userId,
      selected_goal_types: state.selectedGoals,
      current_section: currentSection,
      draft: state as unknown as Json,
      completion: completion.overall,
      revision: (previous?.revision ?? 0) + 1,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("We could not save your Passport draft.");
  return { completion, contradictions: findContradictions(state) };
}

function cleanDate(value: string): string | null {
  return value || null;
}

export async function confirmPassport(
  client: Client,
  userId: string,
  state: PassportState,
  trigger = "initial_review",
) {
  const parsed = passportStateSchema.safeParse(state);
  if (!parsed.success) throw new Error("Please review the highlighted Passport fields.");
  const normalized = parsed.data;
  const contradictions = findContradictions(normalized);
  if (contradictions.length)
    throw new Error("Please resolve the contradictory dates or scores before confirming.");

  const profile = await client
    .from("profiles")
    .update({
      display_name: normalized.preferredName,
      citizenship_country: normalized.citizenshipCountry,
      residence_country: normalized.residenceCountry,
      current_region: normalized.currentRegion,
      relocation_timeline: normalized.relocationTimeline,
      passport_available: normalized.passportAvailable,
      passport_expiry: cleanDate(normalized.passportExpiry),
      willing_to_relocate: normalized.willingToRelocate,
    })
    .eq("id", userId);
  if (profile.error) throw new Error("We could not save your origin information.");

  const tables = [
    "user_goals",
    "education_records",
    "employment_records",
    "user_skills",
    "certifications",
    "trade_experience",
    "language_profiles",
    "country_preferences",
  ] as const;
  for (const table of tables) {
    const result = await client.from(table).delete().eq("user_id", userId);
    if (result.error) throw new Error("We could not update your structured Passport records.");
  }
  if (normalized.selectedGoals.length) {
    const result = await client.from("user_goals").insert(
      normalized.selectedGoals.map((goal, index) => ({
        user_id: userId,
        goal_type: goal,
        priority: index + 1,
      })),
    );
    if (result.error) throw new Error("We could not save your selected goals.");
  }
  if (normalized.education.length) {
    const result = await client.from("education_records").insert(
      normalized.education.map((item) => ({
        user_id: userId,
        institution: item.institution,
        country: item.country,
        qualification_level: item.qualificationLevel,
        field_of_study: item.fieldOfStudy,
        start_date: cleanDate(item.startDate),
        completion_date: cleanDate(item.completionDate),
        graduation_status: item.graduationStatus,
        grade_classification: item.gradeClassification,
        gpa_value: item.gpaValue,
        gpa_scale: item.gpaScale,
        result_pending: item.resultPending,
        expected_graduation_date: cleanDate(item.expectedGraduationDate),
        transcript_available: item.transcriptAvailable,
        research_experience: item.researchExperience,
        publications: item.publications,
        academic_awards: item.academicAwards,
      })),
    );
    if (result.error) throw new Error("We could not save your academic history.");
  }
  if (normalized.employment.length) {
    const result = await client.from("employment_records").insert(
      normalized.employment.map((item) => ({
        user_id: userId,
        employer: item.employer,
        job_title: item.jobTitle,
        country: item.country,
        employment_type: item.employmentType,
        start_date: cleanDate(item.startDate),
        end_date: cleanDate(item.endDate),
        currently_employed: item.currentlyEmployed,
        responsibilities: item.responsibilities,
        achievements: item.achievements,
        industry: item.industry,
        occupation_category: item.occupationCategory,
        management_experience: item.managementExperience,
        remote_international_experience: item.remoteInternationalExperience,
      })),
    );
    if (result.error) throw new Error("We could not save your professional history.");
  }
  if (normalized.skills.length) {
    const result = await client.from("user_skills").insert(
      normalized.skills.map((item) => ({
        user_id: userId,
        skill_name: item.skillName,
        normalized_name: normalizeSkillName(item.skillName),
        category: item.category,
        proficiency: item.proficiency,
        years_experience: item.yearsExperience,
        evidence: item.evidence,
      })),
    );
    if (result.error) throw new Error("We could not save your skills.");
  }
  if (normalized.certifications.length) {
    const result = await client.from("certifications").insert(
      normalized.certifications.map((item) => ({
        user_id: userId,
        name: item.name,
        issuer: item.issuer,
        jurisdiction: item.jurisdiction,
        issue_date: cleanDate(item.issueDate),
        expiry_date: cleanDate(item.expiryDate),
        no_expiry: item.noExpiry,
        credential_status: item.credentialStatus,
        credential_url: item.credentialUrl,
        occupation_or_skill: item.occupationOrSkill,
      })),
    );
    if (result.error) throw new Error("We could not save your certifications.");
  }
  if (normalized.trade.length) {
    const result = await client.from("trade_experience").insert(
      normalized.trade.map((item) => ({
        user_id: userId,
        trade_or_occupation: item.tradeOrOccupation,
        apprenticeship_status: item.apprenticeshipStatus,
        practical_years: item.practicalYears,
        experience_documentation: item.experienceDocumentation,
        employer_or_self_employed: item.employerOrSelfEmployed,
        trade_certification: item.tradeCertification,
        licensing_status: item.licensingStatus,
        portfolio_available: item.portfolioAvailable,
        tools_equipment: item.toolsEquipment,
        driving_licence_classes: item.drivingLicenceClasses,
        willing_to_complete_licensing: item.willingToCompleteLicensing,
        preferred_destination: item.preferredDestination,
      })),
    );
    if (result.error) throw new Error("We could not save your trade experience.");
  }
  if (normalized.languages.length) {
    const result = await client.from("language_profiles").insert(
      normalized.languages.map((item) => ({
        user_id: userId,
        language: item.language,
        proficiency: item.proficiency,
        test_name: item.testName,
        test_status: item.testStatus,
        overall_score: item.overallScore,
        component_scores: item.componentScores,
        test_date: cleanDate(item.testDate),
        expiry_date: cleanDate(item.expiryDate),
        target_score: item.targetScore,
        planned_test_date: cleanDate(item.plannedTestDate),
      })),
    );
    if (result.error) throw new Error("We could not save your language profile.");
  }
  if (normalized.destinations.length) {
    const result = await client.from("country_preferences").insert(
      normalized.destinations.map((country, index) => ({
        user_id: userId,
        country_code: country,
        rank: index + 1,
        excluded: false,
        open_to_other: normalized.openToOtherDestinations,
        opportunity_types: normalized.opportunityTypes,
        start_timeframe: normalized.startTimeframe,
        funding_requirement: normalized.fundingRequirement,
        salary_expectation: normalized.salaryExpectation,
        willing_to_learn_language: normalized.willingToLearnLanguage,
        work_mode: normalized.workMode,
      })),
    );
    if (result.error) throw new Error("We could not save your destination preferences.");
  }

  const { data: latest } = await client
    .from("profile_versions")
    .select("version_number")
    .eq("user_id", userId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error: snapshotError } = await client.from("profile_versions").insert({
    user_id: userId,
    version_number: (latest?.version_number ?? 0) + 1,
    trigger,
    snapshot: normalized as unknown as Json,
  });
  if (snapshotError) throw new Error("Your Passport was saved, but its version could not be created.");
  return calculateCompletion(normalized);
}
