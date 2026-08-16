-- Ensure professional skill persistence can recover accounts created before the professional row existed.
create or replace function public.replace_my_skills(p_skills jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_skill uuid;
  v_level public.experience_level;
  v_years numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Never allow a company/admin account to create a professional record.
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'professional'
  ) then
    raise exception 'This account is not registered as a professional';
  end if;

  -- Recover a professional row if onboarding/session setup created only the profile.
  insert into public.professionals (id, professional_type)
  values (auth.uid(), 'doctor')
  on conflict (id) do nothing;

  if exists (
    select 1 from public.professionals
    where id = auth.uid() and verification_status = 'suspended'
  ) then
    raise exception 'Professional account unavailable';
  end if;

  delete from public.professional_skills
  where professional_id = auth.uid();

  for item in select * from jsonb_array_elements(coalesce(p_skills, '[]'::jsonb)) loop
    select id into v_skill
    from public.skills
    where slug = lower(trim(item->>'slug'));

    if v_skill is null then
      raise exception 'Unknown skill: %', item->>'slug';
    end if;

    begin
      v_level = coalesce(nullif(item->>'level','')::public.experience_level, 'basic');
    exception when invalid_text_representation then
      raise exception 'Invalid skill level for %', item->>'slug';
    end;

    v_years = greatest(coalesce((item->>'years')::numeric, 0), 0);

    insert into public.professional_skills (
      professional_id, skill_id, experience_level, years_experience
    ) values (
      auth.uid(), v_skill, v_level, v_years
    );
  end loop;
end;
$$;

grant execute on function public.replace_my_skills(jsonb) to authenticated;
