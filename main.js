/** // script.js
const scriptURL = 'https://script.google.com/macros/s/AKfycbyk0lOsnCjinDUvVRjukGHQa8YsqY8STdOewL9a-lt0oZsFqQMwguXgNxdpURrL38XYGA/exec'; // Replace with your Google Apps Script URL

function submitEntry() {
    const name = document.getElementById('name').value;
    const vehicleNo = document.getElementById('vehicleNo').value;
    const village = document.getElementById('village').value;
    const entryDate = document.getElementById('entryDate').value;
    const entryTime = document.getElementById('entryTime').value;

    const formData = new FormData();
    formData.append('action', 'addEntry');
    formData.append('name', name);
    formData.append('vehicleNo', vehicleNo);
    formData.append('village', village);
    formData.append('entryDate', entryDate);
    formData.append('entryTime', entryTime);

    fetch(scriptURL, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        document.getElementById('entryForm').reset();
    })
    .catch(error => {
        console.error('Error!', error.message);
        alert('An error occurred.');
    });
}

function submitExit() {
    const vehicleNo = document.getElementById('exitVehicleNo').value;
    const exitDate = document.getElementById('exitDate').value;
    const exitTime = document.getElementById('exitTime').value;
    const price = document.getElementById('price').value;

    const formData = new FormData();
    formData.append('action', 'addExit');
    formData.append('vehicleNo', vehicleNo);
    formData.append('exitDate', exitDate);
    formData.append('exitTime', exitTime);
    formData.append('price', price);

    fetch(scriptURL, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        document.getElementById('exitForm').reset();
    })
    .catch(error => {
        console.error('Error!', error.message);
        alert('An error occurred.');
    });
}
**/
