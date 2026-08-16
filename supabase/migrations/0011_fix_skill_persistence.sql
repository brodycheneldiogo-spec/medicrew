-- Fix skill persistence: the mobile catalog uses stable slugs, while the database uses UUIDs.
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
    select id into v_skill from public.skills where slug=lower(trim(item->>'slug'));
    if v_skill is null then raise exception 'Unknown skill: %', item->>'slug'; end if;
    v_level=coalesce(nullif(item->>'level','')::public.experience_level,'basic');
    v_years=greatest(coalesce((item->>'years')::numeric,0),0);
    insert into public.professional_skills(professional_id,skill_id,experience_level,years_experience)
    values(auth.uid(),v_skill,v_level,v_years);
  end loop;
end;
$$;
grant execute on function public.replace_my_skills(jsonb) to authenticated;
