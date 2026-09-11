import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createDocxExport, createPdfExport } from "@/server/assistant/export";
import { getExportRevision, recordExport } from "@/server/assistant/service";
import { getCurrentUser } from "@/server/auth/service";
import { createSupabaseRouteClient } from "@/server/supabase/route";
import { hasPaidEntitlement } from "@/server/billing/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieResponse = NextResponse.json({ ok: true });
  const client = createSupabaseRouteClient(request, cookieResponse);
  const user = await getCurrentUser(client);
  if (!user)
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  if (!(await hasPaidEntitlement(user.id)))
    return NextResponse.json(
      { error: "A verified paid plan is required to export drafts." },
      { status: 402 },
    );
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format");
  if (!z.string().uuid().safeParse(id).success || !["pdf", "docx"].includes(format ?? ""))
    return NextResponse.json({ error: "Choose PDF or DOCX for a valid draft." }, { status: 400 });
  try {
    const revision = await getExportRevision(user.id, id);
    const buffer =
      format === "pdf"
        ? await createPdfExport(revision.title, revision.content)
        : await createDocxExport(revision.title, revision.content);
    await recordExport({
      admin: revision.admin,
      userId: user.id,
      draftId: id,
      revisionId: revision.revisionId,
      format: format!,
      checksum: createHash("sha256").update(buffer).digest("hex"),
    });
    const slug =
      revision.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "wayfound-draft";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-disposition": `attachment; filename="${slug}.${format}"`,
        "content-type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Approve an owned draft revision before exporting it." },
      { status: 403 },
    );
  }
}
