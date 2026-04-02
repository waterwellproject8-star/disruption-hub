import { supabase } from './supabase.js'

// Web Push uses VAPID keys for authentication.
// Generate yours once: npx web-push generate-vapid-keys
// Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to your .env.local

// ── SEND PUSH TO A DRIVER ─────────────────────────────────────────────────────
export async function sendPushToDriver(driverId, payload) {
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('driver_id', driverId)

  if (error || !subs?.length) return { sent: 0 }

  let sent = 0
  for (const sub of subs) {
    try {
      await sendWebPush(sub, payload)
      sent++
      await supabase
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', sub.id)
    } catch (err) {
      // If subscription is invalid (410 Gone), remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  return { sent }
}

// ── SEND PUSH TO ALL DRIVERS FOR A CLIENT ─────────────────────────────────────
export async function sendPushToClient(clientId, payload) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('client_id', clientId)

  if (!subs?.length) return { sent: 0 }

  let sent = 0
  for (const sub of subs) {
    try {
      await sendWebPush(sub, payload)
      sent++
    } catch {}
  }
  return { sent }
}

// ── CORE WEB PUSH SEND ────────────────────────────────────────────────────────
async function sendWebPush(subscription, payload) {
  // Using the web-push library via dynamic import
  // npm install web-push
  const webpush = await import('web-push').then(m => m.default || m)

  webpush.setVapidDetails(
    `mailto:${process.env.FROM_EMAIL || 'ops@disruptionhub.ai'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    }
  }

  const data = typeof payload === 'string' ? payload : JSON.stringify({
    title: payload.title || 'DisruptionHub',
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: payload.data || {},
    actions: payload.actions || [],
    requireInteraction: payload.urgent || false,
    tag: payload.tag || 'dh-notification',
  })

  await webpush.sendNotification(pushSubscription, data)
}

// ── SAVE A PUSH SUBSCRIPTION ──────────────────────────────────────────────────
export async function savePushSubscription({ clientId, driverId, driverName, subscription, userAgent }) {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      client_id: clientId,
      driver_id: driverId,
      driver_name: driverName,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
      last_used_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

  if (error) throw error
}
