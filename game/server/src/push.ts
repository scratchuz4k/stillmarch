// Web Push with VAPID keys made on first start and kept in the database.

import webpush from 'web-push'
import type { Store } from './db.ts'

export function setupPush(store: Store, contact: string) {
  let keys = store.getMeta('vapid')
  if (!keys) {
    keys = JSON.stringify(webpush.generateVAPIDKeys())
    store.setMeta('vapid', keys)
  }
  const vapid = JSON.parse(keys) as { publicKey: string; privateKey: string }
  webpush.setVapidDetails(contact, vapid.publicKey, vapid.privateKey)

  function send(accountId: string, title: string, body: string): void {
    for (const sub of store.pushSubs(accountId)) {
      webpush
        .sendNotification(JSON.parse(sub.data), JSON.stringify({ title, body }), { TTL: 3600 })
        .catch((err: { statusCode?: number }) => {
          // The browser dropped the subscription.
          if (err.statusCode === 404 || err.statusCode === 410) store.deletePushSub(sub.endpoint)
        })
    }
  }

  return { publicKey: vapid.publicKey, send }
}
