grant select on table public.missions to authenticated;

drop trigger if exists professional_auto_submit_review on public.professional_documents;
drop trigger if exists company_auto_submit_review on public.company_verification_documents;

create or replace function public.accept_current_legal_terms()
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 insert into public.legal_acceptances(profile_id,terms_version,privacy_version,data_policy_version)
 values(v_uid,'2.1','1.2','1.1')
 on conflict(profile_id,terms_version,privacy_version,data_policy_version) do nothing;
end;$$;
revoke all on function public.accept_current_legal_terms() from public,anon;
grant execute on function public.accept_current_legal_terms() to authenticated;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path=public,auth as $$
declare v_uid uuid:=auth.uid();v_email text;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select lower(email) into v_email from auth.users where id=v_uid;
 if v_email='work.medicrew.app@gmail.com' then raise exception 'The designated MediCrew admin account cannot be deleted in the app'; end if;
 delete from auth.users where id=v_uid;
end;$$;
revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;
