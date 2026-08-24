Deno.serve(() =>
  Response.json(
    {
      error: "Push notifications are disabled. MediCrew uses transactional email only.",
    },
    { status: 410 },
  ),
);
