alter table public.professionals
  add column if not exists spoken_languages text[] not null default '{}'::text[];

alter table public.professionals
  drop constraint if exists professionals_spoken_languages_limit;

alter table public.professionals
  add constraint professionals_spoken_languages_limit
  check (cardinality(spoken_languages) <= 20);

create or replace function public.network_profile(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
 select case p.role
 when 'professional' then jsonb_build_object(
   'id',p.id,'role',p.role,'first_name',p.first_name,'last_name',p.last_name,
   'email',p.email,'phone',p.phone,'avatar_url',p.avatar_url,'headline',p.headline,
   'bio',p.bio,'city',p.city,'country',p.country,
   'professional_type',pr.professional_type,'specialty',pr.specialty,
   'spoken_languages',pr.spoken_languages,'nationality',pr.nationality,
   'years_experience',pr.years_experience,'base_airport_code',pr.base_airport_code,
   'base_city',pr.base_city,'verification_status',pr.verification_status,
   'license_country',pr.license_country,'license_authority',pr.license_authority)
 when 'company' then jsonb_build_object(
   'id',p.id,'role',p.role,'company_name',c.company_name,'email',p.email,
   'phone',p.phone,'avatar_url',p.avatar_url,'headline',p.headline,'bio',p.bio,
   'city',p.city,'country',p.country,'company_type',c.company_type,
   'website',c.website,'verification_status',c.verification_status)
 else null end
 from public.profiles p
 left join public.professionals pr on pr.id=p.id
 left join public.companies c on c.id=p.id
 where public.caller_has_verified_network_access()
   and p.id=p_profile_id
   and not p.is_banned
   and not public.users_are_blocked((select auth.uid()),p.id)
   and ((p.role='professional' and pr.verification_status='verified')
     or (p.role='company' and c.verification_status='verified')
     or p.id=(select auth.uid()));
$function$;
