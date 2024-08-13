Issue 1250 fixed : allowed {as,hs}_token to be specified as {as,hs_token_path} instead in registration.yaml

Implementation Notes:

Token Handling Logic:

The application should first check if the *_token_path fields are set.
If they are, it should read the token from the specified file, strip any leading/trailing whitespace, and use it as the token.
If the *_token_path fields are not set, the application should fall back to using the *_token fields.

Security Considerations:

Ensure that the files containing the tokens have appropriate file permissions to prevent unauthorized access.
The application should handle potential errors such as file not found, permission denied, or empty token file gracefully.

Backward Compatibility:

This change is backward-compatible as it allows the use of either the direct token value (as_token/hs_token) or the path-based approach (as_token_path/hs_token_path).

Special Note : Also if we're allowing the use of either the direct token (as_token/hs_token) or the path-based token (as_token_path/hs_token_path), then neither
 as_token nor hs_token should be marked as strictly required on their own in the required container.
