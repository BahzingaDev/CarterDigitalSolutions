from getpass import getpass

from werkzeug.security import generate_password_hash


def main() -> None:
    password = getpass("New admin password: ")
    confirmation = getpass("Confirm admin password: ")

    if len(password) < 12:
        raise SystemExit("Password must contain at least 12 characters.")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    password_hash = generate_password_hash(password, method="scrypt")
    print("\nRender environment variable")
    print("Key:   ADMIN_PASSWORD_HASH")
    print(f"Value: {password_hash}")
    print("\nPaste the complete Value, beginning with 'scrypt:' and without quotes.")


if __name__ == "__main__":
    main()
