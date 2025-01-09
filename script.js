// Get the hamburger icon and mobile menu
const hamburgerIcon = document.getElementById('hamburger-icon');
const mobileMenu = document.getElementById('mobile-menu');

// Toggle the mobile menu when the hamburger icon is clicked
hamburgerIcon.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
});