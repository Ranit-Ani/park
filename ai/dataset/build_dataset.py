"""
Generates parking_intents.csv (training) and test_data.csv (held-out testing)
from hand-written example phrasings per intent.

Run once from the ai/ directory:
    python dataset/build_dataset.py

This is a data-authoring script, not part of the runtime pipeline. Re-run it
any time you want to add more phrasings for an intent, then re-train.
"""
import csv
import random
from pathlib import Path

random.seed(42)

# tag -> (train_examples, test_examples)
# test_examples are deliberately worded differently from train_examples so
# evaluate.py measures real generalization, not memorization.
DATA = {
    "greeting": (
        [
            "hi", "hello", "hey there", "good morning", "good evening",
            "hey", "hiya", "yo", "hello there", "hi assistant",
            "good afternoon", "greetings", "hey bot", "hi there!",
            "morning", "hello parking assistant", "sup",
        ],
        ["hey how are you", "hi again", "good day", "hello!!"],
    ),
    "thanks": (
        [
            "thanks", "thank you", "thanks a lot", "appreciate it",
            "thank you so much", "ty", "thanks for the help",
            "cool thanks", "great, thank you", "thanks buddy",
            "much appreciated", "perfect thank you", "awesome thanks",
        ],
        ["thank you very much", "thanks so much for that", "appreciated!"],
    ),
    "goodbye": (
        [
            "bye", "goodbye", "see you later", "talk to you later",
            "bye bye", "gotta go", "see ya", "later", "cya",
            "that's all bye", "im done bye", "exiting now bye",
        ],
        ["see you soon", "gotta run bye", "alright bye now"],
    ),
    "check_availability": (
        [
            "how many slots are available", "is there any parking available right now",
            "show me available slots", "any free slots in block a",
            "what's the availability like", "how many ev slots are open",
            "is faculty parking full", "check slot availability",
            "how many standard slots are free", "any disabled slots available",
            "what slots are open right now", "how many parking spots are left",
            "is there space to park", "show current slot status",
            "how many total slots do we have", "are there any open ev charging slots",
            "what's the hourly rate for standard slots", "how much does faculty parking cost per hour",
            "any parking near block b", "how many slots are occupied right now",
            "can i find a free slot right now", "got any open parking spots",
            "is there an empty slot i can use",
        ],
        [
            "got any open spots", "can i find a free slot",
            "what's the rate for ev slots", "is parking full today",
        ],
    ),
    "occupancy_insights": (
        [
            "when is parking busiest", "what are the peak hours",
            "what time is parking least crowded", "which day is busiest for parking",
            "what's the average parking session length", "show me occupancy trends",
            "which slots are used the most", "what are the quiet hours",
            "how does demand change during the day", "give me usage patterns",
            "when should i avoid coming to park", "what's the busiest day of the week",
            "show historical occupancy data", "most used parking slots",
            "give me the busy times for parking", "what times are the busiest",
        ],
        [
            "when is it quietest here", "what hours have the most demand",
            "give me the busy times", "typical session duration?",
        ],
    ),
    "my_bookings": (
        [
            "show my bookings", "what's my booking history",
            "do i have any active bookings", "list my past bookings",
            "what's the status of my booking", "show my recent reservations",
            "any bookings under my name", "check my booking status",
            "have i booked a slot", "show my last 5 bookings",
            "what vehicle did i use for my last booking", "my current booking",
            "is my booking still active", "show completed bookings for me",
            "show my parking history", "check my own parking history",
        ],
        [
            "pull up my reservations", "what have i booked so far",
            "any pending bookings for me", "check my parking history",
        ],
    ),
    "my_vehicles": (
        [
            "show my saved vehicles", "what vehicles do i have on file",
            "list my vehicles", "do i have a car saved",
            "check my registered vehicles", "what's my vehicle registration number",
            "show all my bikes and cars", "my saved vehicle list",
            "which vehicles are linked to my account", "view my vehicles",
            "what cars are on my profile", "show vehicles i've added",
            "do i have any bikes saved", "list vehicles on my account",
            "what's on my vehicle list", "pull up my saved cars",
        ],
        [
            "show me the vehicles tied to my profile", "any bikes registered to me",
            "display my current vehicle list", "what vehicles have i already added",
        ],
    ),
    "revenue_report": (
        [
            "show me the revenue report", "how much revenue did we make this month",
            "total earnings from bookings", "give me a revenue summary",
            "what's our average bill amount", "show revenue for last week",
            "how much money did parking generate", "revenue report for this quarter",
            "total completed bookings revenue", "show earnings between these dates",
            "what's the total income from parking", "give me the billing summary",
            "how much did we earn today from parking", "show total collections this month",
        ],
        [
            "how much did we earn today", "show total collections",
            "what's our revenue looking like", "give me the income breakdown",
        ],
    ),
    "user_registry": (
        [
            "how many users do we have", "show user counts by role",
            "how many staff members are there", "how many admins are in the system",
            "give me a summary of registered users", "how many active users are there",
            "show inactive accounts count", "how many users vs staff vs admin",
            "user registry summary", "total number of registered accounts",
            "give me the user breakdown by role", "breakdown of users staff and admins",
        ],
        [
            "how many people are registered", "give me the user breakdown",
            "how many active accounts do we have", "count of staff vs users",
        ],
    ),
    "booking_policy": (
        [
            "how does booking work", "can i book a slot in advance",
            "how long can i hold a booking before checking in",
            "what happens if i don't check in on time", "can i book multiple slots at once",
            "how do i reserve a parking spot", "explain the booking process",
            "how do i make a reservation", "can i schedule a booking for tomorrow",
            "what's the booking time limit", "how many bookings can i have at once",
            "does my booking expire", "steps to book a slot",
        ],
        [
            "walk me through booking a slot", "can i pre-book for next week",
            "what's the deadline before a booking expires", "rules around reserving a spot",
        ],
    ),
    "cancellation_policy": (
        [
            "how do i cancel my booking", "can i cancel after checking in",
            "is there a cancellation fee", "what happens if i cancel a booking",
            "how to cancel a reservation", "can staff cancel my booking for me",
            "can i cancel an active booking", "cancel booking process",
            "will i be charged if i cancel", "how do i undo a reservation",
            "does cancelling cost anything", "can i cancel my slot before check in",
            "is there a fee to cancel a booking",
        ],
        [
            "steps to cancel a reservation", "can i get a refund if i cancel",
            "does cancelling my booking cost money", "can i cancel once i'm checked in",
        ],
    ),
    "checkin_policy": (
        [
            "how does check in work", "who checks me in",
            "can i check myself in", "what happens during check in",
            "where do i check in", "how do i check in my vehicle",
            "does check in expire", "what if staff can't check me in on time",
            "explain the check-in process", "how is check-in done",
            "how do i get my booking checked in", "what happens after i'm checked in",
        ],
        [
            "who handles check in for parking", "do i check in myself or staff does",
            "what's the check-in procedure for a booking", "how does my booking get checked in",
        ],
    ),
    "checkout_billing_policy": (
        [
            "how does checkout work", "how is my bill calculated",
            "how much will i be charged", "how do i get a receipt",
            "what happens when i check out", "is billing rounded up",
            "how is parking fee calculated", "who checks me out",
            "explain the checkout and billing process", "can i download my receipt",
            "minimum billing time for parking", "how much for 1 hour 10 minutes of parking",
            "what's the minimum charge for parking", "how are parking fees rounded",
        ],
        [
            "how do parking fees get calculated", "explain how billing works at checkout",
            "how do i get billed for parking", "what's the smallest amount i can be charged",
        ],
    ),
    "vehicle_management": (
        [
            "how do i add a new vehicle", "can i save multiple vehicles",
            "how do i edit my vehicle details", "how do i remove a saved vehicle",
            "what vehicle types are supported", "can i add a bus or truck",
            "my vehicle has no registration number yet",
            "how to manage my vehicles", "can i add a bike and a car both",
            "steps to save a new vehicle to my account", "how do i delete a saved vehicle",
            "what kinds of vehicles can i register", "how do i update my vehicle's details",
            "process for adding a new vehicle", "can i register a heavy vehicle",
            "how do i mark registration pending for a new bike",
        ],
        [
            "guide for adding a vehicle to my account", "how do i remove a vehicle entry",
            "what vehicle categories does the app support", "steps to edit vehicle details",
        ],
    ),
    "account_management": (
        [
            "how do i change my password", "how do i update my profile picture",
            "how do i change my email", "how do i delete my account",
            "can i update my name on my profile", "how do i verify my new email",
            "is deleting my account reversible", "how do i manage account security",
            "update my profile settings", "change my account email address",
            "steps to reset my account password", "how do i permanently close my account",
            "how do i edit my display name", "how to change my profile photo",
            "how do i secure my account", "can i change my login email",
        ],
        [
            "how do i update my personal profile info", "steps to delete my account for good",
            "how do i change my account security settings", "how do i edit my profile photo",
        ],
    ),
    "scan_plate_help": (
        [
            "how do i scan a license plate", "how does plate scanning work",
            "can i take a photo of my plate instead of typing it",
            "the plate scanner isn't reading my plate", "how to use the camera to add a vehicle",
            "scan my number plate automatically", "auto fill registration number",
        ],
        [
            "how does the camera scan feature work", "tips for scanning a plate clearly",
            "can i photograph my plate to register it",
        ],
    ),
    "staff_checkin_process": (
        [
            "how do i check in a visitor as staff", "staff check in console instructions",
            "how do i verify a vehicle at check in", "steps for staff to check someone in",
            "how do i find a user's pending booking", "check in console guide for staff",
            "as staff how do i process a check in", "how do i confirm check in for a user",
        ],
        [
            "walk me through the staff check-in flow", "how do i verify someone at check in",
        ],
    ),
    "staff_checkout_process": (
        [
            "how do i check out a vehicle as staff", "staff checkout console instructions",
            "how do i generate a receipt for a user", "steps for staff to check someone out",
            "how do i confirm checkout and calculate the bill", "checkout console guide for staff",
            "as staff how do i process a checkout", "how do i close out an active booking as staff",
        ],
        [
            "how do i close out an active booking",
            "walk me through the staff checkout flow",
        ],
    ),
    "admin_slot_management": (
        [
            "how do i add a new parking slot", "how do i change a slot's hourly rate",
            "how do i deactivate a slot", "how do i edit slot type or location",
            "admin guide to managing slots", "how do i mark a slot as ev charging",
            "how do i set up a new faculty slot",
        ],
        [
            "steps to add a slot as admin", "how do i update a slot's rate",
            "how do i take a slot out of service",
        ],
    ),
    "admin_user_management": (
        [
            "how do i change a user's role", "how do i promote a user to staff",
            "how do i deactivate a user account", "how do i make someone an admin",
            "admin guide to managing users", "how do i activate a suspended account",
        ],
        [
            "steps to change someone's role", "how do i disable a user's account",
            "how do i give staff access to a user",
        ],
    ),
    "unknown": (
        [
            "what's the weather today", "tell me a joke",
            "who is the president", "what's 2 plus 2",
            "recommend me a movie", "sing me a song",
            "what's the capital of france", "can you write my essay",
            "what's your favorite color", "how old are you",
            "tell me about the stock market", "what's the meaning of life",
            "play some music for me", "translate this sentence to spanish",
            "what's in the news today", "help me with my homework",
            "write me a poem", "what's your name",
            "tell me a fun fact", "how do i cook pasta",
        ],
        [
            "play a song", "translate this to hindi",
            "give me the latest headlines", "can you do my math homework",
        ],
    ),
}


def main():
    out_dir = Path(__file__).parent
    train_path = out_dir / "parking_intents.csv"
    test_path = out_dir / "test_data.csv"

    train_rows = []
    test_rows = []
    for tag, (train_ex, test_ex) in DATA.items():
        for text in train_ex:
            train_rows.append((text, tag))
        for text in test_ex:
            test_rows.append((text, tag))

    random.shuffle(train_rows)
    random.shuffle(test_rows)

    with open(train_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["text", "intent"])
        writer.writerows(train_rows)

    with open(test_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["text", "intent"])
        writer.writerows(test_rows)

    print(f"Wrote {len(train_rows)} training rows across {len(DATA)} intents -> {train_path}")
    print(f"Wrote {len(test_rows)} test rows -> {test_path}")


if __name__ == "__main__":
    main()
