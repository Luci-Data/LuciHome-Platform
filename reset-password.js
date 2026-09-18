// ==========================================================================
// LuciHome — password reset with an emailed verification code
// ==========================================================================

let resetEmail = '';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('requestCodeForm').addEventListener('submit', handleRequestCode);
  document.getElementById('verifyCodeForm').addEventListener('submit', handleVerifyAndReset);
  document.getElementById('resendCode').addEventListener('click', () => {
    document.getElementById('stepVerifyCode').style.display = 'none';
    document.getElementById('stepRequestCode').style.display = 'block';
  });
});

async function handleRequestCode(e) {
  e.preventDefault();
  resetEmail = document.getElementById('resetEmail').value.trim();

  const btn = document.getElementById('btnSendCode');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  const { error } = await supabaseClient.auth.resetPasswordForEmail(resetEmail);

  btn.disabled = false;
  btn.textContent = 'Send reset code';

  if (error) {
    showToast('Could not send the code: ' + error.message, 'danger');
    return;
  }

  document.getElementById('codeSentTo').textContent = resetEmail;
  document.getElementById('stepRequestCode').style.display = 'none';
  document.getElementById('stepVerifyCode').style.display = 'block';
  showToast('Check your email for the verification code.', 'success');
}

async function handleVerifyAndReset(e) {
  e.preventDefault();

  const code = document.getElementById('resetCode').value.trim();
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('newPasswordConfirm').value;

  if (newPassword !== confirmPassword) {
    showToast('Passwords do not match.', 'danger');
    return;
  }

  const btn = document.getElementById('btnResetPassword');
  btn.disabled = true;
  btn.textContent = 'Resetting…';

  // Verifying the code signs the person in with a temporary "recovery" session.
  const { error: verifyError } = await supabaseClient.auth.verifyOtp({
    email: resetEmail,
    token: code,
    type: 'recovery'
  });

  if (verifyError) {
    showToast('Invalid or expired code: ' + verifyError.message, 'danger');
    btn.disabled = false;
    btn.textContent = 'Reset password';
    return;
  }

  const { error: updateError } = await supabaseClient.auth.updateUser({ password: newPassword });

  btn.disabled = false;
  btn.textContent = 'Reset password';

  if (updateError) {
    showToast('Could not set your new password: ' + updateError.message, 'danger');
    return;
  }

  showToast('Password updated! You are now logged in.', 'success');

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) logNotification(user.id, 'password_changed', 'Password changed', 'Your password was reset successfully.');

  setTimeout(() => { window.location.href = 'index.html'; }, 1200);
}
