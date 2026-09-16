// ==========================================================================
// LuciHome — notification bell (Stage 8 add-on)
//
// Shows how many unread messages the logged-in person has, and keeps that
// number live (updates the moment a new message arrives) on whichever
// page they're currently on — not just the messages page itself.
// ==========================================================================

let notifChannel = null;

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) initNotifications(session.user.id);

  supabaseClient.auth.onAuthStateChange((_event, newSession) => {
    if (newSession?.user) {
      initNotifications(newSession.user.id);
    } else {
      if (notifChannel) supabaseClient.removeChannel(notifChannel);
      updateNotifBadge(0);
    }
  });

  document.getElementById('btnNotifications')?.addEventListener('click', () => {
    window.location.href = 'messages.html';
  });
});

async function initNotifications(userId) {
  await refreshUnreadCount(userId);
  subscribeToNewMessageNotifications(userId);
}

async function refreshUnreadCount(userId) {
  const { count, error } = await supabaseClient
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('read', false);

  if (!error) updateNotifBadge(count || 0);
}

function subscribeToNewMessageNotifications(userId) {
  if (notifChannel) supabaseClient.removeChannel(notifChannel);

  notifChannel = supabaseClient
    .channel(`notifications-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `recipient_id=eq.${userId}`
    }, () => {
      refreshUnreadCount(userId);
    })
    .subscribe();
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
