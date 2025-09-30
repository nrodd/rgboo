#!/usr/bin/env python3
"""
Test script to verify profanity filtering in usernames
"""
import sys
import os
sys.path.append('/Users/nathan/Documents/GitHub/rgboo/middleware')

from better_profanity import profanity

def test_profanity_filter():
    print("🛡️  Testing Username Profanity Filter")
    print("=" * 45)
    
    # Initialize profanity filter
    profanity.load_censor_words()
    
    # Test cases
    test_usernames = [
        # Clean usernames (should pass)
        ("alice", False),
        ("bob123", False),
        ("gaming_pro", False),
        ("cooluser", False),
        ("stream_fan", False),
        
        # Usernames with profanity (should fail)
        ("badword_user", True),  # This might not trigger - let's see
        ("f***ing_gamer", True),
        ("sh*t_user", True),
        
        # Edge cases
        ("", False),  # Empty string
        ("a", False),  # Single character
        ("user_2025", False),  # With numbers
    ]
    
    print("\n📝 Testing usernames:")
    
    passed = 0
    failed = 0
    
    for username, should_contain_profanity in test_usernames:
        contains_profanity = profanity.contains_profanity(username)
        
        # Check if result matches expectation
        if contains_profanity == should_contain_profanity:
            status = "✅ PASS"
            passed += 1
        else:
            status = "❌ FAIL"
            failed += 1
        
        profanity_status = "🚫 BLOCKED" if contains_profanity else "✅ ALLOWED"
        print(f"  {status} '{username}' -> {profanity_status}")
    
    print(f"\n📊 Test Results:")
    print(f"  Passed: {passed}")
    print(f"  Failed: {failed}")
    
    # Show some examples of what gets censored
    print(f"\n🔍 Profanity Detection Examples:")
    test_words = ["hello", "test", "damn", "shit", "fuck", "badword"]
    
    for word in test_words:
        if profanity.contains_profanity(word):
            censored = profanity.censor(word)
            print(f"  '{word}' -> BLOCKED (censored: '{censored}')")
        else:
            print(f"  '{word}' -> allowed")
    
    print(f"\n🎯 Implementation Notes:")
    print(f"  - Profanity check happens after basic validation")
    print(f"  - Returns 400 error with clear message")
    print(f"  - Logs warning for monitoring")
    print(f"  - Uses 'better-profanity' package")

if __name__ == "__main__":
    test_profanity_filter()