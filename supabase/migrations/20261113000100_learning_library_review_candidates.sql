-- Read-only candidate extraction for the staging G検定 app.
-- Keep answer visibility under the existing answer_events RLS policies.
create function public.learning_library_review_candidates()
returns table (question_id text, last_answered_at timestamptz, attempt_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
    with recent_answers as (
        select
            event.question_id,
            event.answered_at,
            event.is_correct,
            count(*) over (partition by event.question_id)::integer as attempt_count,
            row_number() over (
                partition by event.question_id
                order by event.answered_at desc, event.created_at desc, event.event_id desc
            ) as answer_rank
        from public.answer_events as event
        where event.user_id = (select auth.uid())
          and event.answered_at >= now() - interval '30 days'
          and event.answered_at <= now()
    )
    select recent.question_id, recent.answered_at, recent.attempt_count
    from recent_answers as recent
    where recent.answer_rank = 1 and recent.is_correct = false
    order by recent.answered_at desc, recent.question_id
    limit 20;
$$;

revoke all on function public.learning_library_review_candidates() from public, anon, authenticated, service_role;
grant execute on function public.learning_library_review_candidates() to authenticated;
