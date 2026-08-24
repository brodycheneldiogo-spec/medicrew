-- Persist professional skills and languages through guarded RPCs.
create or replace function public.get_my_professional_details()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'skills', coalesce((select jsonb_agg(jsonb_build_object('skill_id',ps.skill_id,'slug',s.slug,'name',s.name,'category',s.category,'level',ps.experience_level,'years',ps.years_experience,'verified',ps.verified) order by s.category,s.name) from public.professional_skills ps join public.skills s on s.id=ps.skill_id where ps.professional_id=auth.uid()), '[]'::jsonb),
    'languages', coalesce((select jsonb_agg(jsonb_build_object('language_code',pl.language_code,'proficiency',pl.proficiency) order by pl.language_code) from public.professional_languages pl where pl.professional_id=auth.uid()), '[]'::jsonb),
    'certifications', coalesce((select jsonb_agg(jsonb_build_object('id',pc.id,'name',pc.name,'issuer',pc.issuer,'issued_at',pc.issued_at,'expires_at',pc.expires_at,'status',pc.status) order by pc.expires_at nulls last,pc.name) from public.professional_certifications pc where pc.professional_id=auth.uid()), '[]'::jsonb)
  )
  where exists (select 1 from public.professionals where id=auth.uid());
$$;
grant execute on function public.get_my_professional_details() to authenticated;

create or replace function public.replace_my_skills(p_skills jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare item jsonb; v_skill uuid; v_level public.experience_level; v_years numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.professionals where id=auth.uid() and verification_status <> 'suspended') then raise exception 'Professional account unavailable'; end if;
  delete from public.professional_skills where professional_id=auth.uid();
  for item in select * from jsonb_array_elements(coalesce(p_skills,'[]'::jsonb)) loop
    select id into v_skill from public.skills where id=(item->>'skill_id')::uuid;
    if v_skill is null then raise exception 'Unknown skill'; end if;
    v_level=coalesce(nullif(item->>'level','')::public.experience_level,'basic');
    v_years=greatest(coalesce((item->>'years')::numeric,0),0);
    insert into public.professional_skills(professional_id,skill_id,experience_level,years_experience) values(auth.uid(),v_skill,v_level,v_years);
  end loop;
end;
$$;
grant execute on function public.replace_my_skills(jsonb) to authenticated;

create or replace function public.replace_my_languages(p_languages jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare item jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.professionals where id=auth.uid() and verification_status <> 'suspended') then raise exception 'Professional account unavailable'; end if;
  delete from public.professional_languages where professional_id=auth.uid();
  for item in select * from jsonb_array_elements(coalesce(p_languages,'[]'::jsonb)) loop
    if length(trim(coalesce(item->>'language_code',''))) between 2 and 10 then
      insert into public.professional_languages(professional_id,language_code,proficiency) values(auth.uid(),lower(trim(item->>'language_code')),coalesce(nullif(item->>'proficiency','')::public.experience_level,'intermediate'));
    end if;
  end loop;
end;
$$;
grant execute on function public.replace_my_languages(jsonb) to authenticated;

