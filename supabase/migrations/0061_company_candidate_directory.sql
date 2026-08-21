create or replace function public.company_assignment_candidates(p_mission_id uuid)
returns table(
 professional_id uuid,first_name text,last_name text,avatar_url text,professional_type public.professional_type,
 specialty text,years_experience integer,base_city text,base_airport_code text,nationality text,reasons text[],available_date date
)
language sql stable security definer set search_path=public as $$
 select p.id,pr.first_name,pr.last_name,pr.avatar_url,p.professional_type,p.specialty,p.years_experience,p.base_city,p.base_airport_code,p.nationality,mm.reasons,d.available_date
 from public.missions m
 join public.mission_matches mm on mm.mission_id=m.id and mm.eligible=true
 join public.professionals p on p.id=mm.professional_id and p.verification_status='verified'
 join public.profiles pr on pr.id=p.id
 left join public.professional_available_days d on d.professional_id=p.id and d.available_date=(m.departure_at at time zone 'UTC')::date
 where m.id=p_mission_id and m.company_id=auth.uid()
 order by p.years_experience desc nulls last,pr.last_name nulls last;
$$;
revoke all on function public.company_assignment_candidates(uuid) from public;
grant execute on function public.company_assignment_candidates(uuid) to authenticated;
