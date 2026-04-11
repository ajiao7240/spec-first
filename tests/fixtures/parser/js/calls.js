function callee() {
  return 1;
}

function caller() {
  return callee();
}

const worker = () => callee();

class Service {
  run() {
    return callee();
  }
}
