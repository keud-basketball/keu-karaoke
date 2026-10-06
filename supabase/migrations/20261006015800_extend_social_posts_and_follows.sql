alter table public.social_posts
  add column if not exists media_type text not null default 'audio';

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'social_posts'
      and column_name = 'media_type'
      and data_type = 'text'
      and is_nullable = 'NO'
      and column_default is not null
  ) then
    raise exception 'public.social_posts.media_type already exists with an incompatible type; review it before continuing.';
  end if;

  if exists (
    select 1
    from public.social_posts
    where media_type is null or media_type not in ('audio', 'photo', 'video')
  ) then
    raise exception 'public.social_posts contains unsupported media_type values; review them before continuing.';
  end if;

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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profile_follows'
      and policyname = 'Authenticated users can view profile follows'
  ) then
    create policy "Authenticated users can view profile follows"
      on public.profile_follows for select to authenticated
      using (public.is_google_user());
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profile_follows'
      and policyname = 'Users can follow profiles as themselves'
  ) then
    create policy "Users can follow profiles as themselves"
      on public.profile_follows for insert to authenticated
      with check (
        public.is_google_user()
        and (select auth.uid()) = follower_id
        and follower_id <> following_id
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profile_follows'
      and policyname = 'Users can unfollow profiles as themselves'
  ) then
    create policy "Users can unfollow profiles as themselves"
      on public.profile_follows for delete to authenticated
      using (public.is_google_user() and (select auth.uid()) = follower_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'social_post_reports'
      and policyname = 'Users can report posts as themselves'
  ) then
    create policy "Users can report posts as themselves"
      on public.social_post_reports for insert to authenticated
      with check (public.is_google_user() and (select auth.uid()) = reporter_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'social_post_reports'
      and policyname = 'Users can view their own post reports'
  ) then
    create policy "Users can view their own post reports"
      on public.social_post_reports for select to authenticated
      using (public.is_google_user() and (select auth.uid()) = reporter_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'social_posts'
      and policyname = 'Users can edit their own social posts'
  ) then
    create policy "Users can edit their own social posts"
      on public.social_posts for update to authenticated
      using (public.is_google_user() and (select auth.uid()) = auth_user_id)
      with check (public.is_google_user() and (select auth.uid()) = auth_user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Users can upload their own Socials media'
  ) then
    create policy "Users can upload their own Socials media"
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
  end if;
end;
$$;
