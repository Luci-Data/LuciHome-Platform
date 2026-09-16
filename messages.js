// ==========================================================================
// LuciHome — Messages / chat (Stage 8)
// ==========================================================================

let currentUserId = null;
let activeConversationId = null;
let activeRecipientId = null;
let activeChannel = null;
let conversationsCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  document.getElementById('messagesLoading').style.display = 'none';

  if (!session || !session.user) {
    document.getElementById('messagesSignedOut').style.display = 'block';
    return;
  }

  currentUserId = session.user.id;
  document.getElementById('messagesShell').style.display = 'grid';

  document.getElementById('chatBackBtn').addEventListener('click', () => {
    document.getElementById('messagesShell').classList.remove('show-thread');
  });
  document.getElementById('chatInputForm').addEventListener('submit', handleSendMessage);

  await loadConversations();

  // Deep link from a listing's "Message owner" button: messages.html?c=<id>
  const openId = new URLSearchParams(window.location.search).get('c');
  if (openId) openConversation(openId);
});

async function loadConversations() {
  const { data, error } = await supabaseClient
    .from('conversations')
    .select('id,listing_id,buyer_id,seller_id,listings(title,listing_photos(photo_url,sort_order)),messages(body,created_at,sender_id)')
    .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`)
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Could not load your conversations: ' + error.message, 'danger');
    return;
  }

  conversationsCache = data || [];

  const list = document.getElementById('convList');
  list.innerHTML = '';

  if (conversationsCache.length === 0) {
    list.innerHTML = `<div class="chat-empty" style="height:100%"><i class="fa-solid fa-comments"></i><p>No conversations yet. Message a seller from any listing page.</p></div>`;
    return;
  }

  for (const conv of conversationsCache) {
    list.appendChild(await renderConvItem(conv));
  }
}

async function renderConvItem(conv) {
  const otherUserId = conv.buyer_id === currentUserId ? conv.seller_id : conv.buyer_id;
  const { data: otherUser } = await supabaseClient.rpc('get_public_profile', { profile_id: otherUserId });
  const other = Array.isArray(otherUser) ? otherUser[0] : otherUser;
  const otherName = other ? `${other.first_name} ${other.last_name}` : 'LuciHome member';

  const photos = (conv.listings?.listing_photos || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const thumbUrl = photos[0]?.photo_url || '';

  const messages = (conv.messages || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const lastMessage = messages[messages.length - 1];

  const item = document.createElement('div');
  item.className = 'conv-item';
  item.dataset.id = conv.id;
  item.innerHTML = `
    ${thumbUrl
      ? `<img class="thumb" src="${thumbUrl}" alt="">`
      : `<div class="thumb" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted)"><i class="fa-solid fa-house"></i></div>`}
    <div class="meta">
      <p class="listing-title">${escapeHtml(conv.listings?.title || 'Listing')}</p>
      <p class="name">${escapeHtml(otherName)}</p>
      <p class="preview">${lastMessage ? escapeHtml(lastMessage.body) : 'No messages yet'}</p>
    </div>
  `;
  item.addEventListener('click', () => openConversation(conv.id));
  return item;
}

async function openConversation(conversationId) {
  activeConversationId = conversationId;

  document.getElementById('messagesShell').classList.add('show-thread');
  document.querySelectorAll('.conv-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === conversationId);
  });

  let conversation = conversationsCache.find((c) => c.id === conversationId);
  if (!conversation) {
    // Came from a fresh deep link not yet in the cached list — reload once.
    await loadConversations();
    conversation = conversationsCache.find((c) => c.id === conversationId);
  }
  if (!conversation) return;

  document.getElementById('chatEmptyState').style.display = 'none';
  document.getElementById('chatActive').style.display = 'flex';

  const otherUserId = conversation.buyer_id === currentUserId ? conversation.seller_id : conversation.buyer_id;
  activeRecipientId = otherUserId;

  const { data: otherUser } = await supabaseClient.rpc('get_public_profile', { profile_id: otherUserId });
  const other = Array.isArray(otherUser) ? otherUser[0] : otherUser;

  document.getElementById('chatOwnerName').textContent = other ? `${other.first_name} ${other.last_name}` : 'LuciHome member';
  document.getElementById('chatListingTitle').textContent = conversation.listings?.title || '';

  const avatarEl = document.getElementById('chatOwnerAvatar');
  if (other?.avatar_url) {
    avatarEl.style.background = `#fff url("${other.avatar_url}") center/cover no-repeat`;
    avatarEl.textContent = '';
  } else {
    avatarEl.style.background = 'var(--accent)';
    avatarEl.textContent = (other?.first_name?.[0] || '?').toUpperCase();
  }

  await loadMessages(conversationId);
  subscribeToConversation(conversationId);
  await markConversationAsRead(conversationId);
}

async function markConversationAsRead(conversationId) {
  const { error } = await supabaseClient
    .from('messages')
    .update({ read: true })
    .eq('conversation_id', conversationId)
    .eq('recipient_id', currentUserId)
    .eq('read', false);

  // notifications.js defines this; it's loaded on every page including this one.
  if (!error && typeof refreshUnreadCount === 'function') refreshUnreadCount(currentUserId);
}

async function loadMessages(conversationId) {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('id,sender_id,body,created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  const box = document.getElementById('chatMessages');
  box.innerHTML = '';

  if (error) {
    showToast('Could not load messages: ' + error.message, 'danger');
    return;
  }

  (data || []).forEach((msg) => appendMessageBubble(msg));
  box.scrollTop = box.scrollHeight;
}

function appendMessageBubble(msg) {
  const box = document.getElementById('chatMessages');
  const mine = msg.sender_id === currentUserId;

  const row = document.createElement('div');
  row.className = `msg-row ${mine ? 'mine' : 'theirs'}`;
  row.innerHTML = `
    <div class="msg-bubble">${escapeHtml(msg.body)}</div>
    <div class="msg-time">${formatTime(msg.created_at)}</div>
  `;
  box.appendChild(row);
}

// Live updates: subscribe to new messages in this conversation only.
function subscribeToConversation(conversationId) {
  if (activeChannel) supabaseClient.removeChannel(activeChannel);

  activeChannel = supabaseClient
    .channel(`conversation-${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`
    }, (payload) => {
      // Avoid duplicating the bubble we already rendered optimistically.
      if (payload.new.sender_id === currentUserId) return;
      appendMessageBubble(payload.new);
      const box = document.getElementById('chatMessages');
      box.scrollTop = box.scrollHeight;
    })
    .subscribe();
}

async function handleSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const body = input.value.trim();
  if (!body || !activeConversationId) return;

  input.value = '';

  const optimisticMsg = { sender_id: currentUserId, body, created_at: new Date().toISOString() };
  appendMessageBubble(optimisticMsg);
  const box = document.getElementById('chatMessages');
  box.scrollTop = box.scrollHeight;

  const { error } = await supabaseClient.from('messages').insert({
    conversation_id: activeConversationId,
    sender_id: currentUserId,
    recipient_id: activeRecipientId,
    body
  });

  if (error) {
    showToast('Message failed to send: ' + error.message, 'danger');
  }
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
