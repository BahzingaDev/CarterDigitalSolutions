from getpass import getpass

from werkzeug.security import generate_password_hash


def main() -> None:
    password = getpass("New admin password: ")
    confirmation = getpass("Confirm admin password: ")

    if len(password) < 12:
        raise SystemExit("Password must contain at least 12 characters.")
    if password != confirmation:
        raise SystemExit("Passwords do not match.")

    print("\nSet ADMIN_PASSWORD_HASH to:\n")
    print(generate_password_hash(password))


if __name__ == "__main__":
    main()
