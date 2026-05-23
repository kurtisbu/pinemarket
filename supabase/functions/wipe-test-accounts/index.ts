import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const ADMIN_ID = '0868c813-aad6-45fe-aa9e-c7812d607e44'
const BUCKETS = ['avatars', 'program-media', 'pine-scripts', 'scripts']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Authorize via CRON_SECRET header only (admin must call from server/curl with the secret)
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== Deno.env.get('CRON_SECRET')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const result: Record<string, unknown> = { deleted_users: [], storage_deleted: {}, errors: [] }

  // 1) Wipe storage objects belonging to non-admin users (folder = user id)
  for (const bucket of BUCKETS) {
    try {
      const { data: folders, error } = await supabase.storage.from(bucket).list('', { limit: 1000 })
      if (error) { result.errors.push({ bucket, error: error.message }); continue }
      const toDelete: string[] = []
      for (const f of folders ?? []) {
        if (!f.name || f.name === ADMIN_ID) continue
        // list everything inside that folder
        const { data: inner } = await supabase.storage.from(bucket).list(f.name, { limit: 1000 })
        for (const item of inner ?? []) toDelete.push(`${f.name}/${item.name}`)
        // also handle file directly at root not owned by admin
        if (f.id) toDelete.push(f.name)
      }
      if (toDelete.length) {
        const { error: delErr } = await supabase.storage.from(bucket).remove(toDelete)
        if (delErr) result.errors.push({ bucket, error: delErr.message })
      }
      ;(result.storage_deleted as Record<string, number>)[bucket] = toDelete.length
    } catch (e) {
      result.errors.push({ bucket, error: (e as Error).message })
    }
  }

  // 2) Delete auth users (except admin)
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) { result.errors.push({ step: 'listUsers', error: error.message }); break }
    if (!data.users.length) break
    for (const u of data.users) {
      if (u.id === ADMIN_ID) continue
      const { error: delErr } = await supabase.auth.admin.deleteUser(u.id)
      if (delErr) result.errors.push({ user: u.email, error: delErr.message })
      else (result.deleted_users as string[]).push(u.email ?? u.id)
    }
    if (data.users.length < 200) break
    page++
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})