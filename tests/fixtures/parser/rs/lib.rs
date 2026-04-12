use std::io;

struct Config {
    name: String,
    value: i32,
}

trait Printable {
    fn format(&self) -> String;
}

fn create_config(name: &str) -> Config {
    Config {
        name: name.to_string(),
        value: 0,
    }
}

impl Config {
    fn new(name: &str, value: i32) -> Self {
        Config { name: name.to_string(), value }
    }
}

impl Printable for Config {
    fn format(&self) -> String {
        format!("{}={}", self.name, self.value)
    }
}
