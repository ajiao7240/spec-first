// fixture: JS 类声明与方法
import { EventEmitter } from 'events';

class Animal {
  constructor(name) {
    this.name = name;
  }

  speak() {
    return `${this.name} makes a sound.`;
  }

  getName() {
    return this.name;
  }
}

class Dog extends Animal {
  speak() {
    return `${this.name} barks.`;
  }
}
