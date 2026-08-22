-- Remove accidental public execution rights from privileged functions.
-- Client-facing RPCs remain available to authenticated users; trigger-only
-- functions are not callable through the Data API.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', fn.signature);
  end loop;
end
$$;

do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname = any(array[
        'auto_submit_company_review','auto_submit_professional_review',
        'bootstrap_designated_admin','capture_email_signup_legal_acceptance',
        'create_mission_payment_after_completion','enforce_verified_company_publish',
        'enqueue_push_for_notification','enqueue_transactional_email',
        'force_company_pending_on_insert','force_professional_pending_on_identity_change',
        'guard_match_email_verification','guard_mission_publication','handle_new_user',
        'prevent_incomplete_professional_profile','protect_company_document_verification_fields',
        'protect_company_verification_status','protect_professional_certification_status',
        'protect_professional_document_verification_fields','protect_professional_skill_verified',
        'protect_professional_verification_status','protect_profile_identity_fields',
        'require_complete_professional_credentials','require_confirmed_email'
      ])
  loop
    execute format('revoke execute on function %s from authenticated', fn.signature);
  end loop;
end
$$;

alter function public.set_updated_at() set search_path = public;
alter function public.level_rank(public.experience_level) set search_path = public;
alter function public.mission_payment_model() set search_path = public;
