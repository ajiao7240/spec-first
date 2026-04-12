#import <UIKit/UIKit.h>
#import "AppDelegate.h"

@protocol DataSourceDelegate <NSObject>
- (NSArray *)itemsForDataSource:(id)sender;
@optional
- (void)dataSourceDidChange:(id)sender;
@end

@interface ViewController : UIViewController <UITableViewDelegate>
@property (nonatomic, weak) id<DataSourceDelegate> delegate;
- (void)viewDidLoad;
@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    [self setupView];
}

- (void)setupView {
    self.view.backgroundColor = [UIColor whiteColor];
}

- (NSArray *)itemsForDataSource:(id)sender {
    return @[@"item1", @"item2"];
}

@end
