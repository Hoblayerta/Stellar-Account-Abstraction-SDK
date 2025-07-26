#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_initialize_account() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SocialWallet);
    let client = SocialWalletClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    
    // Test successful initialization
    let result = client.initialize(
        &owner,
        &String::from_str(&env, "google"),
        &String::from_str(&env, "user@gmail.com")
    );
    
    assert_eq!(result, true);
    
    // Verify account was created
    let account = client.get_account(&owner);
    assert!(account.is_some());
    
    let account = account.unwrap();
    assert_eq!(account.owner, owner);
    assert_eq!(account.is_initialized, true);
}

#[test]
fn test_duplicate_initialization_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SocialWallet);
    let client = SocialWalletClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    
    // First initialization should succeed
    let result1 = client.initialize(
        &owner,
        &String::from_str(&env, "google"),
        &String::from_str(&env, "user@gmail.com")
    );
    assert_eq!(result1, true);
    
    // Second initialization should fail
    let result2 = client.initialize(
        &owner,
        &String::from_str(&env, "facebook"),
        &String::from_str(&env, "user@facebook.com")
    );
    assert_eq!(result2, false);
}

#[test]
fn test_add_auth_method() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SocialWallet);
    let client = SocialWalletClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    
    // Initialize with Google
    client.initialize(
        &owner,
        &String::from_str(&env, "google"),
        &String::from_str(&env, "user@gmail.com")
    );
    
    // Mock authorization
    env.mock_all_auths();
    
    // Add Facebook method
    let result = client.add_auth_method(
        &owner,
        &String::from_str(&env, "facebook"),
        &String::from_str(&env, "user@facebook.com")
    );
    
    assert_eq!(result, true);
    
    // Verify both methods exist
    assert_eq!(
        client.has_auth_method(&owner, &String::from_str(&env, "google")),
        true
    );
    assert_eq!(
        client.has_auth_method(&owner, &String::from_str(&env, "facebook")),
        true
    );
}

#[test]
fn test_get_auth_methods() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SocialWallet);
    let client = SocialWalletClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    
    // Initialize with Google
    client.initialize(
        &owner,
        &String::from_str(&env, "google"),
        &String::from_str(&env, "user@gmail.com")
    );
    
    env.mock_all_auths();
    
    // Add more methods
    client.add_auth_method(
        &owner,
        &String::from_str(&env, "facebook"),
        &String::from_str(&env, "user@facebook.com")
    );
    
    client.add_auth_method(
        &owner,
        &String::from_str(&env, "phone"),
        &String::from_str(&env, "+1234567890")
    );
    
    // Get all methods
    let methods = client.get_auth_methods(&owner);
    assert_eq!(methods.len(), 3);
}

#[test]
fn test_remove_auth_method() {
    let env = Env::default();
    let contract_id = env.register_contract(None, SocialWallet);
    let client = SocialWalletClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    
    // Initialize and add methods
    client.initialize(
        &owner,
        &String::from_str(&env, "google"),
        &String::from_str(&env, "user@gmail.com")
    );
    
    env.mock_all_auths();
    
    client.add_auth_method(
        &owner,
        &String::from_str(&env, "facebook"),
        &String::from_str(&env, "user@facebook.com")
    );
    
    // Remove Facebook method
    let result = client.remove_auth_method(
        &owner,
        &String::from_str(&env, "facebook")
    );
    
    assert_eq!(result, true);
    
    // Verify Facebook method is gone but Google remains
    assert_eq!(
        client.has_auth_method(&owner, &String::from_str(&env, "facebook")),
        false
    );
    assert_eq!(
        client.has_auth_method(&owner, &String::from_str(&env, "google")),
        true
    );
}
