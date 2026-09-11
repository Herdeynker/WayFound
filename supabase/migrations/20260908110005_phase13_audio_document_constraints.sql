-- Phase 13 forward-only extension: private speaking recordings reuse the Phase 9
-- versioned document store. Permit only the audio formats validated by the API,
-- while preserving the original 10 MB limit for non-audio documents.

alter table public.document_metadata
  drop constraint document_size;

alter table public.document_metadata
  add constraint document_size check (
    size_bytes is null
    or (
      size_bytes > 0
      and (
        size_bytes <= 10485760
        or (
          mime_type in ('audio/webm', 'audio/wav', 'audio/ogg', 'audio/mp4')
          and size_bytes <= 15728640
        )
      )
    )
  );

alter table public.document_versions
  drop constraint document_versions_mime_type_check,
  drop constraint document_versions_size_bytes_check;

alter table public.document_versions
  add constraint document_versions_mime_type_check check (
    mime_type in (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'audio/webm',
      'audio/wav',
      'audio/ogg',
      'audio/mp4'
    )
  ),
  add constraint document_versions_size_bytes_check check (
    size_bytes > 0
    and (
      size_bytes <= 10485760
      or (
        mime_type in ('audio/webm', 'audio/wav', 'audio/ogg', 'audio/mp4')
        and size_bytes <= 15728640
      )
    )
  );
