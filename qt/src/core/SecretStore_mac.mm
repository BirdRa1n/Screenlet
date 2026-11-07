#include "SecretStore.h"

#import <Foundation/Foundation.h>
#import <Security/Security.h>

namespace {
NSString *const kService = @"com.screenlet.app.secrets";

NSMutableDictionary *baseQuery(const QString &account)
{
    return [@{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: kService,
        (__bridge id)kSecAttrAccount: account.toNSString(),
    } mutableCopy];
}
} // namespace

namespace SecretStore {

bool platformStore(const QString &account, const QString &secret)
{
    NSMutableDictionary *q = baseQuery(account);
    SecItemDelete((__bridge CFDictionaryRef)q);
    q[(__bridge id)kSecValueData] = [secret.toNSString() dataUsingEncoding:NSUTF8StringEncoding];
    q[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleAfterFirstUnlock;
    return SecItemAdd((__bridge CFDictionaryRef)q, nullptr) == errSecSuccess;
}

QString platformLoad(const QString &account)
{
    NSMutableDictionary *q = baseQuery(account);
    q[(__bridge id)kSecReturnData] = @YES;
    q[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;
    CFTypeRef result = nullptr;
    if (SecItemCopyMatching((__bridge CFDictionaryRef)q, &result) != errSecSuccess || !result)
        return {};
    NSData *data = (__bridge_transfer NSData *)result;
    NSString *s = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    return QString::fromNSString(s);
}

void platformRemove(const QString &account)
{
    SecItemDelete((__bridge CFDictionaryRef)baseQuery(account));
}

} // namespace SecretStore
