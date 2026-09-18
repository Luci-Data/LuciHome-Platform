// ==========================================================================
// LuciHome — notification bell (Stage 8 add-on, expanded for account/listing events)
//
// The bell now covers two kinds of "unread": private chat messages, and
// system notifications (profile updated, listing published/changed/deleted,
// password reset). Clicking the bell opens a small panel listing the
// system notifications; a link inside goes to the full Messages page.
// ==========================================================================

let notifMsgChannel = null;
let notifSystemChannel = null;
let currentNotifUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) initNotifications(session.user.id);

  supabaseClient.auth.onAuthStateChange((_event, newSession) => {
    if (newSession?.user) {
      initNotifications(newSession.user.id);
    } else {
      if (notifMsgChannel) supabaseClient.removeChannel(notifMsgChannel);
      if (notifSystemChannel) supabaseClient.removeChannel(notifSystemChannel);
      updateNotifBadge(0);
    }
  });

  const wrap = document.getElementById('notifDropdownWrap');
  const panel = document.getElementById('notifPanel');
  if (wrap && panel) {
    document.getElementById('btnNotifications').addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open') && currentNotifUserId) {
        loadNotificationList(currentNotifUserId);
      }
    });
    document.addEventListener('click', (e) => {
      if (panel.classList.contains('open') && !wrap.contains(e.target)) {
        panel.classList.remove('open');
      }
    });
  }

  document.getElementById('notifViewMessages')?.addEventListener('click', () => {
    window.location.href = 'messages.html';
  });
});

async function initNotifications(userId) {
  currentNotifUserId = userId;
  await refreshUnreadCount(userId);
  subscribeToNewMessageNotifications(userId);
  subscribeToSystemNotifications(userId);
}

async function refreshUnreadCount(userId) {
  const [{ count: msgCount }, { count: notifCount }] = await Promise.all([
    supabaseClient.from('messages').select('id', { count: 'exact', head: true }).eq('recipient_id', userId).eq('read', false),
    supabaseClient.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false)
  ]);
  updateNotifBadge((msgCount || 0) + (notifCount || 0));
}

function subscribeToNewMessageNotifications(userId) {
  if (notifMsgChannel) supabaseClient.removeChannel(notifMsgChannel);
  notifMsgChannel = supabaseClient
    .channel(`notifications-messages-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${userId}`
    }, () => refreshUnreadCount(userId))
    .subscribe();
}

function subscribeToSystemNotifications(userId) {
  if (notifSystemChannel) supabaseClient.removeChannel(notifSystemChannel);
  notifSystemChannel = supabaseClient
    .channel(`notifications-system-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`
    }, () => refreshUnreadCount(userId))
    .subscribe();
}

async function loadNotificationList(userId) {
  const list = document.getElementById('notifList');
  if (!list) return;

  const { data, error } = await supabaseClient
    .from('notifications')
    .select('id,type,title,body,read,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(15);

  if (error) {
    list.innerHTML = `<div class="notif-empty">Could not load notifications.</div>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="notif-empty">No notifications yet.</div>`;
    return;
  }

  list.innerHTML = data.map((n) => `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
      <p class="t">${escapeHtmlNotif(n.title)}</p>
      ${n.body ? `<p class="b">${escapeHtmlNotif(n.body)}</p>` : ''}
      <p class="ts">${timeAgo(n.created_at)}</p>
    </div>
  `).join('');

  list.querySelectorAll('.notif-item').forEach((el) => {
    el.addEventListener('click', () => markNotificationRead(el.dataset.id, el));
  });

  // Mark everything currently shown as read shortly after opening, and
  // refresh the badge to reflect it.
  const unreadIds = data.filter((n) => !n.read).map((n) => n.id);
  if (unreadIds.length > 0) {
    await supabaseClient.from('notifications').update({ read: true }).in('id', unreadIds);
    refreshUnreadCount(userId);
  }
}

async function markNotificationRead(id, el) {
  el.classList.remove('unread');
  await supabaseClient.from('notifications').update({ read: true }).eq('id', id);
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// Fire-and-forget helper other pages call to log an account/listing event.
async function logNotification(userId, type, title, body) {
  await supabaseClient.from('notifications').insert({ user_id: userId, type, title, body: body || null });
}

function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtmlNotif(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
