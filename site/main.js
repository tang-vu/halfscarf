// halfscarf landing — progressive enhancement only. With JS disabled the page is
// fully readable: the .js class gates every hidden-until-revealed style.

document.documentElement.classList.add('js')

// Seamless marquee: the CSS animates -50%, so the track needs its content twice.
const track = document.querySelector('.ticker-track')
if (track) track.innerHTML += track.innerHTML

// Scroll reveals — staggered via .d2–.d6 transition delays in CSS.
const revealed = document.querySelectorAll('.reveal')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('in')
          io.unobserve(e.target)
        }
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
  )
  revealed.forEach((el) => io.observe(el))
} else {
  revealed.forEach((el) => el.classList.add('in'))
}
