const claimURL = document.getElementById('nyt-claim-url');
const claimPassword = document.getElementById('nyt-claim-password');

const submitButton = document.getElementById('submit-claim');
submitButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'send-claim', data: { claimURL: claimURL.value, claimPassword: claimPassword.value } }, ({ success }) => {
    if (success) {
      submitButton.style.background = 'green';
      submitButton.innerText = 'Claim submitted';
    } else {
      submitButton.style.background = 'red';
      submitButton.innerText = 'Error';
    }

    setTimeout(() => {
      submitButton.style.background = 'white';
      submitButton.innerText = 'Submit';
    }, 1000);
  });
});

// set the elements claimURL and claimPassword to the values of the cookies
chrome.runtime.sendMessage({ type: 'get-claim' }, (response) => {
  claimURL.value = response.claimURL;
  claimPassword.value = response.claimPassword;
  console.log(response);
});