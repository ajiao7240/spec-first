import Foundation
import UIKit

class AppDelegate: UIResponder {
    func application() -> Bool {
        return true
    }
}

struct Config {
    let name: String
}

protocol Delegate {
    func didLoad()
}
