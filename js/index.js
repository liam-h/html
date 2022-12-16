const firebaseConfig = {
  apiKey: "AIzaSyB4DrHjDuQMyXrPdzNsC95gjuOxNBcAqMg",
  authDomain: "project-smartapps.firebaseapp.com",
  projectId: "project-smartapps",
  storageBucket: "project-smartapps.appspot.com",
  messagingSenderId: "640992130831",
  appId: "1:640992130831:web:23ee7eb48f7130555e707a",
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();
const ref = firebase.storage().ref();
const PDFDoc = PDFLib.PDFDocument;
const metadata = document.getElementById("metadata");
const form = Array.from(metadata.children).slice(0, -1);
metadata.style.display = "none";

let orderBy;
let ascending = true;

async function getBooks() {
  const books = document.getElementById("books");
  const currentUser = auth.currentUser.uid;
  const queryRef = db.collection("userbook").where("uid", "==", currentUser);

  console.log(orderBy);
  console.log(ascending);
  const querySnapshot =
    orderBy == null
      ? await queryRef.get()
      : await queryRef.orderBy(orderBy, ascending ? "asc" : "desc").get();

  if (querySnapshot.empty) {
    console.log("No files found for this user");
    return;
  }
  // hier wordt de metadata van de file opgehaald en de download url
  querySnapshot.forEach(async function callback(v, i) {
    const field = v.data();
    console.log(field);
    const bookHash = field.hash;
    const url = await ref.child(bookHash).getDownloadURL();

    books.innerHTML += `
    <li>
    <ul id="book${i}">
    <li>Title: ${field.title}</li>
    <li>Author: ${field.author}</li>
    <li>Year: ${field.year}</li>
    <li>Pages: ${field.pages}</li>
    <li>Hash: ${bookHash}</li>
    <li><a href="${url}">Download</a></li>
    <li><button id="delete${i}"
    value="${bookHash}"
    onclick="deleteBook(event, ${i})"
    >Delete</button></li>
    </ul>
    </li>`;
  });
}

async function deleteBook(e, id) {
  e.preventDefault();
  const currentUser = auth.currentUser.uid;
  const hash = document.getElementById("delete" + id).value;
  console.log(currentUser + hash);
  console.log("function deleteBook called");
  await db
    .collection("userbook")
    .doc(currentUser + hash)
    .delete();
}

auth.onAuthStateChanged(function (user) {
  const loggedIn = document.getElementById("loggedin");
  const notLoggedIn = document.getElementById("loggedout");
  const username = document.getElementById("username");
  if (user) {
    loggedIn.style.display = "block";
    notLoggedIn.style.display = "none";
    username.innerHTML = user.email;
    getBooks();
  } else {
    notLoggedIn.style.display = "block";
    loggedIn.style.display = "none";
  }
});

async function login(e) {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("pass").value;
  console.log(email, password);
  try {
    const user = await auth.signInWithEmailAndPassword(email, password);
    console.log(user.user.uid);
  } catch (error) {
    alert(error.message);
  }
}

async function logout(e) {
  e.preventDefault();
  try {
    await auth.signOut();
  } catch (error) {
    alert(error.message);
  }
}

async function upload(e) {
  e.preventDefault();
  const currentUser = auth.currentUser.uid;
  // dit is de file die je upload
  const file = document.getElementById("file").files[0];

  // hier wordt de file omgezet naar een string om de hash te berekenen
  var reader = new FileReader();
  reader.onloadend = async function () {
    text = reader.result;

    // hier wordt de hash berekend
    var hash = CryptoJS.MD5(CryptoJS.enc.Latin1.parse(text));
    hash = hash.toString();

    // hier wordt gekeken of de hash al bestaat in de database
    const collectionRef = db.collection("userbook");
    const queryRef = collectionRef.where("hash", "==", hash);
    // als de hash nog niet bestaat in de database wordt de file geupload naar de storage
    if ((await queryRef.get()).empty) {
      const storageRef = storage.ref();
      const fileRef = storageRef.child(hash);
      await fileRef.put(file);
      console.log("Uploaded");
    }

    // hier wordt de hash en de uid van de gebruiker opgeslagen in de database
    const data = {
      uid: currentUser,
      hash: hash,
      title: form[0].value,
      author: form[1].value,
      year: form[2].value,
      pages: form[3].value,
    };
    await collectionRef.doc(currentUser + hash).set(data);
    alert("DB entry created");
  };

  // dit activeert de onloadend functie
  reader.readAsBinaryString(file);
}

function showMetadata(e) {
  e.preventDefault();
  metadata.style.display = "block";

  const file = document.getElementById("file").files[0];

  //Step 2: Read the file using file reader
  var fileReader = new FileReader();

  fileReader.onload = async function () {
    //Step 4:turn array buffer into typed array
    var typedarray = new Uint8Array(this.result);

    const pdfDoc = await PDFDoc.load(typedarray);

    const pdfInfo = [
      pdfDoc.getTitle(),
      pdfDoc.getAuthor(),
      pdfDoc.getCreationDate().toISOString().substring(0, 10),
      pdfDoc.getPageCount(),
    ];

    // Als er geen metadata is wordt er een lege string geplaatst en de placeholder tekst blijft staan
    pdfInfo.forEach(function callback(v, i) {
      form[i].value = v == null ? "" : v;
    });

    console.log(pdfInfo);
  };
  //Step 3:Read the file as ArrayBuffer
  fileReader.readAsArrayBuffer(file);
}

document
  .getElementById("sortOptionList")
  .addEventListener("input", function (e) {
    e.preventDefault();
    orderBy = e.target.value;
    getBooks();
  });

document.getElementById("asc").addEventListener("change", function (e) {
  e.preventDefault();
  ascending = e.target.checked;
  document.getElementById("ascLabel").innerHTML = ascending
    ? "Ascending"
    : "Descending";
  getBooks();
});
