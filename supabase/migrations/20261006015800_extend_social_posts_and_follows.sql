alter table public.social_posts
  add column if not exists media_type text not null default 'audio';

comment on column public.social_posts.recording_path is
  'Private Storage path for audio, photo, or video post media.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_posts_media_type_check'
      and conrelid = 'public.social_posts'::regclass
  ) then
    alter table public.social_posts
      add constraint social_posts_media_type_check
      check (media_type in ('audio', 'photo', 'video'));
  end if;
end;
$$;

create table if not exists public.profile_follows (
  follower_id uuid not null references public.profiles (auth_user_id) on delete cascade,
  following_id uuid not null references public.profiles (auth_user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint profile_follows_not_self_check check (follower_id <> following_id)
);

create index if not exists profile_follows_following_id_idx
  on public.profile_follows (following_id);

create table if not exists public.social_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (auth_user_id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create index if not exists social_post_reports_created_at_idx
  on public.social_post_reports (created_at desc);

alter table public.profile_follows enable row level security;
alter table public.social_post_reports enable row level security;

grant select, insert, delete on public.profile_follows to authenticated;
grant select, insert on public.social_post_reports to authenticated;
grant update (caption) on public.social_posts to authenticated;

drop policy if exists "Authenticated users can view profile follows" on public.profile_follows;
create policy "Authenticated users can view profile follows"
  on public.profile_follows for select to authenticated
  using (public.is_google_user());

drop policy if exists "Users can follow profiles as themselves" on public.profile_follows;
create policy "Users can follow profiles as themselves"
  on public.profile_follows for insert to authenticated
  with check (
    public.is_google_user()
    and (select auth.uid()) = follower_id
    and follower_id <> following_id
  );

drop policy if exists "Users can unfollow profiles as themselves" on public.profile_follows;
create policy "Users can unfollow profiles as themselves"
  on public.profile_follows for delete to authenticated
  using (public.is_google_user() and (select auth.uid()) = follower_id);

drop policy if exists "Users can report posts as themselves" on public.social_post_reports;
create policy "Users can report posts as themselves"
  on public.social_post_reports for insert to authenticated
  with check (public.is_google_user() and (select auth.uid()) = reporter_id);

drop policy if exists "Users can view their own post reports" on public.social_post_reports;
create policy "Users can view their own post reports"
  on public.social_post_reports for select to authenticated
  using (public.is_google_user() and (select auth.uid()) = reporter_id);

drop policy if exists "Users can edit their own social posts" on public.social_posts;
create policy "Users can edit their own social posts"
  on public.social_posts for update to authenticated
  using (public.is_google_user() and (select auth.uid()) = auth_user_id)
  with check (public.is_google_user() and (select auth.uid()) = auth_user_id);

drop policy if exists "Users can upload their own performances" on storage.objects;
create policy "Users can upload their own performances"
  on storage.objects for insert to authenticated
  with check (
    public.is_google_user()
    and bucket_id = 'social-recordings'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and lower(storage.extension(name)) in (
      'webm', 'm4a', 'mp4', 'ogg', 'mp3', 'wav',
      'jpg', 'jpeg', 'png', 'webp'
    )
  );

update storage.buckets
set allowed_mime_types = array[
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/mpeg',
  'audio/wav',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm'
]
where id = 'social-recordings';
