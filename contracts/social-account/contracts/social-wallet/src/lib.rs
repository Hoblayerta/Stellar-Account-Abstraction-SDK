#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Map, Vec};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct SocialAccount {
    pub owner: Address,
    pub auth_methods: Map<String, String>, // method_type -> identifier
    pub is_initialized: bool,
    pub created_at: u64,
}

#[contract]
pub struct SocialWallet;

#[contractimpl]
impl SocialWallet {
    /// Initialize account with first auth method
    pub fn initialize(
        env: Env,
        owner: Address,
        method_type: String,
        identifier: String,
    ) -> bool {
        // Use owner address as key to support multiple accounts per contract
        if env.storage().instance().has(&owner) {
            return false; // Account already exists
        }
        
        let mut auth_methods = Map::new(&env);
        auth_methods.set(method_type, identifier);
        
        let account = SocialAccount {
            owner: owner.clone(),
            auth_methods,
            is_initialized: true,
            created_at: env.ledger().timestamp(),
        };
        
        env.storage().instance().set(&owner, &account);
        true
    }
    
    /// Add new authentication method (requires auth from owner)
    pub fn add_auth_method(
        env: Env,
        owner: Address,
        method_type: String,
        identifier: String,
    ) -> bool {
        // Require authorization from the owner
        owner.require_auth();
        
        if let Some(mut account) = env.storage().instance().get::<Address, SocialAccount>(&owner) {
            account.auth_methods.set(method_type, identifier);
            env.storage().instance().set(&owner, &account);
            return true;
        }
        false
    }
    
    /// Get account info
    pub fn get_account(env: Env, owner: Address) -> Option<SocialAccount> {
        env.storage().instance().get(&owner)
    }
    
    /// Check if specific auth method exists for account
    pub fn has_auth_method(env: Env, owner: Address, method_type: String) -> bool {
        if let Some(account) = env.storage().instance().get::<Address, SocialAccount>(&owner) {
            return account.auth_methods.contains_key(method_type);
        }
        false
    }
    
    /// Get all auth methods for an account
    pub fn get_auth_methods(env: Env, owner: Address) -> Vec<String> {
        if let Some(account) = env.storage().instance().get::<Address, SocialAccount>(&owner) {
            let mut methods = Vec::new(&env);
            for key in account.auth_methods.keys() {
                methods.push_back(key);
            }
            return methods;
        }
        Vec::new(&env)
    }
    
    /// Remove auth method (requires auth from owner)
    pub fn remove_auth_method(
        env: Env,
        owner: Address,
        method_type: String,
    ) -> bool {
        owner.require_auth();
        
        if let Some(mut account) = env.storage().instance().get::<Address, SocialAccount>(&owner) {
            if account.auth_methods.contains_key(method_type.clone()) {
                account.auth_methods.remove(method_type);
                env.storage().instance().set(&owner, &account);
                return true;
            }
        }
        false
    }
    
    /// Transfer ownership to new address (requires auth from current owner)
    pub fn transfer_ownership(
        env: Env,
        current_owner: Address,
        new_owner: Address,
    ) -> bool {
        current_owner.require_auth();
        
        if let Some(mut account) = env.storage().instance().get::<Address, SocialAccount>(&current_owner) {
            // Remove from old key
            env.storage().instance().remove(&current_owner);
            
            // Set new owner and save to new key
            account.owner = new_owner.clone();
            env.storage().instance().set(&new_owner, &account);
            return true;
        }
        false
    }
}

mod test;
