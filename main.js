var tabnames = document.getElementsByClassName("tabnames");
var tabnamescontent = document.getElementsByClassName("tabnamescontent");

          function opentab(x){
              for(tabname of tabnames){
                  tabname.classList.remove("active1");
              }
              for(tabnamesconten of tabnamescontent){
                  tabnamesconten.classList.remove("active2");
              }
              event.currentTarget.classList.add("active1");
              document.getElementById(x).classList.add("active2");
          }
         /*contact form*/

<script>
  const scriptURL = 'https://script.google.com/macros/s/AKfycbwwLc1u1jmRkVpA1eP7JfA3RsK4cFCI_eXrusyXI1evxDUv_WREelu79H45W1UIyjpK/exec'
const form = document.forms['submit-to-google-sheet']

  form.addEventListener('submit', e => {
    e.preventDefault()
    fetch(scriptURL, { method: 'POST', body: new FormData(form)})
      .then(response => console.log('Success!', response))
      .catch(error => console.error('Error!', error.message))
  })
</script>