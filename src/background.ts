function polling() {
  setInterval(() => {
    console.log("hello from background!");
  }, 5000);
}

polling();
