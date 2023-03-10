// Register the service worker
if ("serviceWorker" in navigator) {
  // Wait for the 'load' event to not block other work
  window.addEventListener("load", async () => {
    // Try to register the service worker.
    try {
      // Capture the registration for later use, if needed
      let reg;

      // Use ES Module version of our Service Worker in development
      // In production, use the normal service worker registration
      reg = await navigator.serviceWorker.register("js/service-worker.js", {
        type: "module",
      });
      //reg = await navigator.serviceWorker.register("/service-worker.js");

      console.log("Service worker registered! 😎", reg);
    } catch (err) {
      console.log("😥 Service worker registration failed: ", err);
    }
  });
}

/* FIREBASE CONFIG
- React: aparte file
*/
const firebaseConfig = {
  apiKey: "AIzaSyB4DrHjDuQMyXrPdzNsC95gjuOxNBcAqMg",
  authDomain: "project-smartapps.firebaseapp.com",
  projectId: "project-smartapps",
  storageBucket: "project-smartapps.appspot.com",
  messagingSenderId: "640992130831",
  appId: "1:640992130831:web:23ee7eb48f7130555e707a",
};

firebase.initializeApp(firebaseConfig);

/* CONST AND VAR DEFINITIONS
- React: imports
*/
// TODO: meeste globale variabelen wegwerken (imports, geen DOM manipulatie)
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();
const ref = firebase.storage().ref();
const PDFDoc = PDFLib.PDFDocument;
const metadata = document.getElementById("metadata");
const note = document.getElementById("note");
const form = Array.from(metadata.children).slice(0, -1);
const show = document.forms["show"].elements["radio"];
const provider = new firebase.auth.GoogleAuthProvider();
metadata.style.display = "none";
note.style.display = "none";

let file;
let orderBy;
let ascending = true;
let showBooks = true;

/* PERSISTENCE
- React: quasi hetzelfde
*/
firebase
  .firestore()
  .enablePersistence(db)
  .catch((err) => {
    // Er wordt niets gelogd als de offline modus succesvol geactiveerd is
    if (err.code == "failed-precondition") {
      // Multiple tabs open, persistence can only be enabled
      // in one tab at a a time.
      // ...
      alert(
        "Multiple tabs open, persistence can only be enabled in one tab at a time."
      );
    } else if (err.code == "unimplemented") {
      // The current browser does not support all of the
      // features required to enable persistence
      // ...
      alert(
        "The current browser does not support all of the features required to enable persistence"
      );
    }
  });

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

/* Schakelt de offline modus aan om te kijken of de data uit de cache komt - Werkt
(async () => {
  await db.disableNetwork(db);
})();*/

/* DATABASE CRUD
- React: DOM manipulatie wegwerken en React componenten gebruiken
*/
async function getBooks() {
  const books = document.getElementById("books");
  const currentUser = auth.currentUser.uid;
  const queryRef = db.collection("userbook").where("uid", "==", currentUser);

  const querySnapshot =
    orderBy == null
      ? await queryRef.get()
      : await queryRef.orderBy(orderBy, ascending ? "asc" : "desc").get();

  // TODO: toevoegen aan de UI
  if (querySnapshot.empty) {
    console.log("No files found for this user");
    return;
  }

  // Hier wordt gekeken of de data uit de cache komt of van de server (kan door Persistence)
  const source = querySnapshot.metadata.fromCache ? "local cache" : "server";
  console.log("Data came from " + source);
  // Hier wordt de metadata van de file opgehaald en de download url
  books.innerHTML = "";
  querySnapshot.forEach(async function callback(v) {
    const field = v.data();
    console.log(field);
    const bookHash = field.hash;
    await ref
      .child(bookHash)
      .getDownloadURL()
      .then((url) => {
        books.innerHTML += `
    <li>
    <ul>
    <li>Title: ${field.title}</li>
    <li>Author: ${field.author}</li>
    <li>Year: ${field.year}</li>
    <li>Pages: ${field.pages}</li>
    <li>Hash: ${bookHash}</li>
    <li><a href="${url}">Download</a></li>
    <li><iframe src="${url}" width="100%" height="100%"></iframe></li>
    <li><button
    value="${bookHash}"
    onclick="deleteBook(event)"
    >Delete</button></li>
    </ul>
    </li>`;
      });
  });
}

function readFile(e) {
  e.preventDefault();
  file = e.target.files[0];
  // Check if file is txt or image
  if (file.type == "image/png" || file.type == "image/jpeg") ocr(e, file);
  const reader = new FileReader();
  reader.onloadend = function (e) {
    document.getElementById("noteContent").innerHTML = reader.result;
  };
  reader.readAsText(file);
  console.log(file);
}

async function getNotes() {
  const notes = document.getElementById("notes");

  const currentUser = auth.currentUser.uid;
  const queryRef = db.collection("notes").where("uid", "==", currentUser);
  const querySnapshot = await queryRef.get();

  if (querySnapshot.empty) {
    console.log("No notes found for this user");
    return;
  }

  querySnapshot.forEach(async function callback(v, i) {
    const field = v.data();
    console.log(field);
    console.log(v.id);
    notes.innerHTML += `
    <li>
    <ul>
    <li><h3>${field.name}</h3></li>
    <li>${field.content}</li>
    <li><button value="${v.id}" onclick="deleteNote(event)">Delete</button></li>
    </ul>
    </li>`;
  });
}

// TODO: functienaam refactoren naar uploadBook
async function upload(e) {
  e.preventDefault();
  const currentUser = auth.currentUser.uid;
  // dit is de file die je upload
  file = document.getElementById("file").files[0];

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
    [title, author, year, pages] = form.elements;
    console.log(title, author, year, pages);
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

async function uploadNote(e) {
  e.preventDefault();
  const currentUser = auth.currentUser.uid;
  const noteName = document.getElementById("noteName").value;
  const noteContent = document.getElementById("noteContent").value;
  const data = {
    uid: currentUser,
    name: noteName,
    content: noteContent,
  };
  await db.collection("notes").add(data);
  alert("Note added");
}

async function deleteBook(e) {
  e.preventDefault();
  const currentUser = auth.currentUser.uid;
  // Sender heeft de hash van het boek als value
  if (confirm("Are you sure you want to delete this book?")) {
    const hash = e.target.value;
    await db
      .collection("userbook")
      .doc(currentUser + hash)
      .delete();
  }
}

async function deleteNote(e) {
  e.preventDefault();
  // Sender heeft de id van de note als value
  if (confirm("Are you sure you want to delete this note?")) {
    const noteId = e.target.value;
    await db.collection("notes").doc(noteId).delete();
  }
}

/* AUTHENTICATION
- React: quasi hetzelfde
*/
auth
  .getRedirectResult()
  .then((result) => {
    if (result.credential) {
      /** @type {firebase.auth.OAuthCredential} */
      var credential = result.credential;

      // This gives you a Google Access Token. You can use it to access the Google API.
      var token = credential.accessToken;
      // ...
    }
    // The signed-in user info.
    var user = result.user;
  })
  .catch((error) => {
    // Handle Errors here.
    var errorCode = error.code;
    var errorMessage = error.message;
    // The email of the user's account used.
    var email = error.email;
    // The firebase.auth.AuthCredential type that was used.
    var credential = error.credential;
    // ...
  });

function googleLogin(e) {
  e.preventDefault();
  auth
    .signInWithPopup(provider)
    .then((result) => {
      /** @type {firebase.auth.OAuthCredential} */
      var credential = result.credential;

      // This gives you a Google Access Token. You can use it to access the Google API.
      var token = credential.accessToken;
      // The signed-in user info.
      var user = result.user;

      auth.signInWithRedirect(provider);
    })
    .catch((error) => {
      // Handle Errors here.
      var errorCode = error.code;
      var errorMessage = error.message;
      // The email of the user's account used.
      var email = error.email;
      // The firebase.auth.AuthCredential type that was used.
      var credential = error.credential;
      // ...
    });
}

auth.onAuthStateChanged(function (user) {
  const loggedIn = document.getElementById("loggedin");
  const notLoggedIn = document.getElementById("loggedout");
  const username = document.getElementById("username");
  if (user) {
    loggedIn.style.display = "block";
    notLoggedIn.style.display = "none";
    document.getElementById("changePassBtn").style = user.providerData[0].providerId == "password" ? "display: block" : "display: none" ;
    username.innerHTML = user.email;
    getBooks();
    getNotes();
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

async function signup(e) {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("pass").value;
  try {
    const user = await auth.createUserWithEmailAndPassword(email, password);
  } catch (error) {
    alert(error.message);
  }
}

async function deleteAccount(e) {
  e.preventDefault();
  if (confirm("Are you sure you want to delete your account?")) {
    try {
      await auth.currentUser.delete();
    } catch (error) {
      alert(error.message);
    }
  }
}

async function changePassword(e) {
  e.preventDefault();
  const oldPassPrompt = prompt("Enter your current password");
  if (oldPassPrompt) {
    try {
      const user = await auth.signInWithEmailAndPassword(
        auth.currentUser.email,
        oldPassPrompt
      ).then(async () => {
        const newPassPrompt = prompt("Enter your new password");
        if (newPassPrompt) {
          try {
            await auth.currentUser.updatePassword(newPassPrompt);
          } catch (error) {
            alert(error.message);
          }
        };
      });
    } catch (error) {
    alert(error.message);
  }
}
}

/* DOM MANIPULATION
- React: UI wordt obsoleet/compleet anders bewerkt (Help mij Stan? :D)
*/
document
  .getElementById("sortOptionList")
  .addEventListener("input", function (e) {
    e.preventDefault();
    orderBy = e.target.value;
    getBooks();
  });

document.getElementById("newNote").addEventListener("click", function (e) {
  e.preventDefault();
  console.log("new note clicked");
  note.style.display = note.style.display == "block" ? "none" : "block";
});

document.getElementById("asc").addEventListener("change", function (e) {
  e.preventDefault();
  ascending = e.target.checked;
  document.getElementById("ascLabel").innerHTML = ascending
    ? "Ascending"
    : "Descending";
  getBooks();
});

for (radio in show) {
  show[radio].onclick = function () {
    if (this.id == "showBooks") {
      books.style.display = "block";
      notes.style.display = "none";
      document.getElementById("bookUploadDiv").style.display = "block";
      document.getElementById("sorting").style.display = "block";
      document.getElementById("newNote").style.display = "none";
    } else {
      books.style.display = "none";
      notes.style.display = "block";
      document.getElementById("bookUploadDiv").style.display = "none";
      document.getElementById("sorting").style.display = "none";
      document.getElementById("newNote").style.display = "block";
    }
  };
}

function showMetadata(e) {
  e.preventDefault();
  metadata.style.display = "block";

  file = document.getElementById("file").files[0];

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

function drop(e) {
  e.preventDefault();
  file = e.dataTransfer.files[0];
  document.getElementById("file").files = e.dataTransfer.files;
  showMetadata(e);
}

function allowDrop(e) {
  e.preventDefault();
}

function cancel(e) {
  e.preventDefault();
  file = null;
  formToReset = document.forms[e.target.value];
  if (e.target.value == "metadata") document.getElementById("file").value = "";
  formToReset.style.display = "none";
  formToReset.reset();
}

function ocr(e, file) {
  e.preventDefault();
  console.log("ocr clicked");
  Tesseract.recognize(e.target.files[0], "eng", {
    logger: (m) => console.log(m),
  }).then(({ data: { text } }) => {
    document.getElementById("noteName").value = "OCR note";
    document.getElementById("noteContent").value = text;
  });
}
