create table if not exists public.profiles (
    auth_user_id uuid primary key references auth.users (id) on delete cascade,
      artist_name text not null check (char_length(btrim(artist_name)) between 2 and 40),
        avatar_url text check (avatar_url is null or avatar_url like auth_user_id::text || '/%'),
          created_at timestamptz not null default now(),
            updated_at timestamptz not null default now()
            );

            create table if not exists public.social_posts (
              id uuid primary key default gen_random_uuid(),
                auth_user_id uuid not null references public.profiles (auth_user_id) on delete cascade,
                  song_title text not null check (char_length(btrim(song_title)) between 1 and 200),
                    artist text not null check (char_length(btrim(artist)) between 1 and 120),
                      caption text not null default '' check (char_length(caption) <= 500),
                        recording_path text not null unique check (recording_path like auth_user_id::text || '/%'),
                          created_at timestamptz not null default now()
                          );

                          create table if not exists public.social_post_likes (
                            post_id uuid not null references public.social_posts (id) on delete cascade,
                              auth_user_id uuid not null references public.profiles (auth_user_id) on delete cascade,
                                created_at timestamptz not null default now(),
                                  primary key (post_id, auth_user_id)
                                  );

                                  create table if not exists public.social_post_comments (
                                    id uuid primary key default gen_random_uuid(),
                                      post_id uuid not null references public.social_posts (id) on delete cascade,
                                        auth_user_id uuid not null references public.profiles (auth_user_id) on delete cascade,
                                          content text not null check (char_length(btrim(content)) between 1 and 500),
                                            created_at timestamptz not null default now()
                                            );

                                            create index if not exists social_posts_created_at_idx
                                              on public.social_posts (created_at desc);
                                              create index if not exists social_post_likes_post_id_idx
                                                on public.social_post_likes (post_id);
                                                create index if not exists social_post_comments_post_id_created_at_idx
                                                  on public.social_post_comments (post_id, created_at);

                                                  create or replace function public.set_profile_updated_at()
                                                  returns trigger
                                                  language plpgsql
                                                  set search_path = ''
                                                  as $$
                                                  begin
                                                    new.updated_at = now();
                                                      return new;
                                                      end;
                                                      $$;

                                                      create or replace function public.is_google_user()
                                                      returns boolean
                                                      language sql
                                                      stable
                                                      set search_path = ''
                                                      as $$
                                                        select coalesce(auth.jwt() -> 'app_metadata' ->> 'provider' = 'google', false);
                                                        $$;

                                                        revoke all on function public.is_google_user() from public;
                                                        grant execute on function public.is_google_user() to authenticated;

                                                        drop trigger if exists profiles_set_updated_at on public.profiles;
                                                        create trigger profiles_set_updated_at
                                                          before update on public.profiles
                                                            for each row execute function public.set_profile_updated_at();

                                                            alter table public.profiles enable row level security;
                                                            alter table public.social_posts enable row level security;
                                                            alter table public.social_post_likes enable row level security;
                                                            alter table public.social_post_comments enable row level security;

                                                            grant select, insert, update on public.profiles to authenticated;
                                                            grant select, insert, delete on public.social_posts to authenticated;
                                                            grant select, insert, delete on public.social_post_likes to authenticated;
                                                            grant select, insert, delete on public.social_post_comments to authenticated;

                                                            drop policy if exists "Authenticated users can view artist profiles" on public.profiles;
                                                            create policy "Authenticated users can view artist profiles"
                                                              on public.profiles for select to authenticated
                                                                using (public.is_google_user());

                                                                drop policy if exists "Users can create their own artist profile" on public.profiles;
                                                                create policy "Users can create their own artist profile"
                                                                  on public.profiles for insert to authenticated
                                                                    with check (public.is_google_user() and (select auth.uid()) = auth_user_id);

                                                                    drop policy if exists "Users can update their own artist profile" on public.profiles;
                                                                    create policy "Users can update their own artist profile"
                                                                      on public.profiles for update to authenticated
                                                                        using (public.is_google_user() and (select auth.uid()) = auth_user_id)
                                                                          with check (public.is_google_user() and (select auth.uid()) = auth_user_id);

                                                                          drop policy if exists "Authenticated users can view social posts" on public.social_posts;
                                                                          create policy "Authenticated users can view social posts"
                                                                            on public.social_posts for select to authenticated
                                                                              using (public.is_google_user());

                                                                              drop policy if exists "Users can create posts for their own profile" on public.social_posts;
                                                                              create policy "Users can create posts for their own profile"
                                                                                on public.social_posts for insert to authenticated
                                                                                  with check (
                                                                                      public.is_google_user()
                                                                                          and (select auth.uid()) = auth_user_id
                                                                                              and recording_path like (select auth.uid()::text) || '/%'
                                                                                                  and exists (
                                                                                                        select 1 from public.profiles
                                                                                                              where profiles.auth_user_id = social_posts.auth_user_id
                                                                                                                  )
                                                                                                                    );

                                                                                                                    drop policy if exists "Users can delete their own social posts" on public.social_posts;
                                                                                                                    create policy "Users can delete their own social posts"
                                                                                                                      on public.social_posts for delete to authenticated
                                                                                                                        using (public.is_google_user() and (select auth.uid()) = auth_user_id);

                                                                                                                        drop policy if exists "Authenticated users can view social post likes" on public.social_post_likes;
                                                                                                                        create policy "Authenticated users can view social post likes"
                                                                                                                          on public.social_post_likes for select to authenticated
                                                                                                                            using (public.is_google_user());

                                                                                                                            drop policy if exists "Users can like posts as themselves" on public.social_post_likes;
                                                                                                                            create policy "Users can like posts as themselves"
                                                                                                                              on public.social_post_likes for insert to authenticated
                                                                                                                                with check (public.is_google_user() and (select auth.uid()) = auth_user_id);

                                                                                                                                drop policy if exists "Users can remove their own likes" on public.social_post_likes;
                                                                                                                                create policy "Users can remove their own likes"
                                                                                                                                  on public.social_post_likes for delete to authenticated
                                                                                                                                    using (public.is_google_user() and (select auth.uid()) = auth_user_id);

                                                                                                                                    drop policy if exists "Authenticated users can view social post comments" on public.social_post_comments;
                                                                                                                                    create policy "Authenticated users can view social post comments"
                                                                                                                                      on public.social_post_comments for select to authenticated
                                                                                                                                        using (public.is_google_user());

                                                                                                                                        drop policy if exists "Users can comment as themselves" on public.social_post_comments;
                                                                                                                                        create policy "Users can comment as themselves"
                                                                                                                                          on public.social_post_comments for insert to authenticated
                                                                                                                                            with check (public.is_google_user() and (select auth.uid()) = auth_user_id);

                                                                                                                                            drop policy if exists "Users can delete their own comments" on public.social_post_comments;
                                                                                                                                            create policy "Users can delete their own comments"
                                                                                                                                              on public.social_post_comments for delete to authenticated
                                                                                                                                                using (public.is_google_user() and (select auth.uid()) = auth_user_id);

                                                                                                                                                insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
                                                                                                                                                values
                                                                                                                                                  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
                                                                                                                                                    ('social-recordings', 'social-recordings', false, 52428800, array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'])
                                                                                                                                                    on conflict (id) do update set
                                                                                                                                                      name = excluded.name,
                                                                                                                                                        public = excluded.public,
                                                                                                                                                          file_size_limit = excluded.file_size_limit,
                                                                                                                                                            allowed_mime_types = excluded.allowed_mime_types;

                                                                                                                                                            drop policy if exists "Authenticated users can view artist pictures" on storage.objects;
                                                                                                                                                            create policy "Authenticated users can view artist pictures"
                                                                                                                                                              on storage.objects for select to authenticated
                                                                                                                                                                using (public.is_google_user() and bucket_id = 'avatars');

                                                                                                                                                                drop policy if exists "Users can upload their own artist pictures" on storage.objects;
                                                                                                                                                                create policy "Users can upload their own artist pictures"
                                                                                                                                                                  on storage.objects for insert to authenticated
                                                                                                                                                                    with check (
                                                                                                                                                                        public.is_google_user()
                                                                                                                                                                            and bucket_id = 'avatars'
                                                                                                                                                                                and (storage.foldername(name))[1] = (select auth.uid()::text)
                                                                                                                                                                                    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
                                                                                                                                                                                      );

                                                                                                                                                                                      drop policy if exists "Users can update their own artist pictures" on storage.objects;
                                                                                                                                                                                      create policy "Users can update their own artist pictures"
                                                                                                                                                                                        on storage.objects for update to authenticated
                                                                                                                                                                                          using (
                                                                                                                                                                                              public.is_google_user()
                                                                                                                                                                                                  and bucket_id = 'avatars'
                                                                                                                                                                                                      and (storage.foldername(name))[1] = (select auth.uid()::text)
                                                                                                                                                                                                        )
                                                                                                                                                                                                          with check (
                                                                                                                                                                                                              public.is_google_user()
                                                                                                                                                                                                                  and bucket_id = 'avatars'
                                                                                                                                                                                                                      and (storage.foldername(name))[1] = (select auth.uid()::text)
                                                                                                                                                                                                                          and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
                                                                                                                                                                                                                            );

                                                                                                                                                                                                                            drop policy if exists "Users can delete their own artist pictures" on storage.objects;
                                                                                                                                                                                                                            create policy "Users can delete their own artist pictures"
                                                                                                                                                                                                                              on storage.objects for delete to authenticated
                                                                                                                                                                                                                                using (
                                                                                                                                                                                                                                    public.is_google_user()
                                                                                                                                                                                                                                        and bucket_id = 'avatars'
                                                                                                                                                                                                                                            and (storage.foldername(name))[1] = (select auth.uid()::text)
                                                                                                                                                                                                                                              );

                                                                                                                                                                                                                                              drop policy if exists "Authenticated users can listen to shared performances" on storage.objects;
                                                                                                                                                                                                                                              create policy "Authenticated users can listen to shared performances"
                                                                                                                                                                                                                                                on storage.objects for select to authenticated
                                                                                                                                                                                                                                                  using (public.is_google_user() and bucket_id = 'social-recordings');

                                                                                                                                                                                                                                                  drop policy if exists "Users can upload their own performances" on storage.objects;
                                                                                                                                                                                                                                                  create policy "Users can upload their own performances"
                                                                                                                                                                                                                                                    on storage.objects for insert to authenticated
                                                                                                                                                                                                                                                      with check (
                                                                                                                                                                                                                                                          public.is_google_user()
                                                                                                                                                                                                                                                              and bucket_id = 'social-recordings'
                                                                                                                                                                                                                                                                  and (storage.foldername(name))[1] = (select auth.uid()::text)
                                                                                                                                                                                                                                                                      and lower(storage.extension(name)) in ('webm', 'm4a', 'mp4', 'ogg', 'mp3')
                                                                                                                                                                                                                                                                        );

                                                                                                                                                                                                                                                                        drop policy if exists "Users can delete their own performances" on storage.objects;
                                                                                                                                                                                                                                                                        create policy "Users can delete their own performances"
                                                                                                                                                                                                                                                                          on storage.objects for delete to authenticated
                                                                                                                                                                                                                                                                            using (
                                                                                                                                                                                                                                                                                public.is_google_user()
                                                                                                                                                                                                                                                                                    and bucket_id = 'social-recordings'
                                                                                                                                                                                                                                                                                        and (storage.foldername(name))[1] = (select auth.uid()::text)
                                                                                                                                                                                                                                                                                          );
