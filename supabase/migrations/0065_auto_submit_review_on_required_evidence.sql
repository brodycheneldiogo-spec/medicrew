-- Automatically submit an account for review once all mandatory evidence has been uploaded.
create or replace function public.auto_submit_professional_review()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_submitted timestamptz;v_status public.verification_status;
begin
 if new.document_type not in ('passport','rpps','diploma') then return new; end if;
 select review_submitted_at,verification_status into v_submitted,v_status from public.professionals where id=new.professional_id;
 if v_submitted is not null and v_status<>'rejected' then return new; end if;
 if exists(select 1 from public.professional_documents d where d.professional_id=new.professional_id and d.document_type='passport' and d.status in('pending','verified'))
 and exists(select 1 from public.professional_documents d where d.professional_id=new.professional_id and d.document_type='rpps' and d.status in('pending','verified'))
 and exists(select 1 from public.professional_documents d where d.professional_id=new.professional_id and d.document_type='diploma' and d.status in('pending','verified')) then
   perform public.submit_my_account_for_review();
 end if;
 return new;
end;$$;
drop trigger if exists professional_auto_submit_review on public.professional_documents;
create trigger professional_auto_submit_review after insert on public.professional_documents for each row execute function public.auto_submit_professional_review();

create or replace function public.auto_submit_company_review()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_submitted timestamptz;v_status public.verification_status;
begin
 select review_submitted_at,verification_status into v_submitted,v_status from public.companies where id=new.company_id;
 if v_submitted is not null and v_status<>'rejected' then return new; end if;
 if new.status in('pending','verified') then perform public.submit_my_account_for_review(); end if;
 return new;
end;$$;
drop trigger if exists company_auto_submit_review on public.company_verification_documents;
create trigger company_auto_submit_review after insert on public.company_verification_documents for each row execute function public.auto_submit_company_review();
