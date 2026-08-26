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
            "hii", "helloo", "hey hey", "yo whats up", "hi bot",
            "good morning assistant", "hello can you help me",
            "hey assistant", "howdy", "hiya there", "wassup",
            "hi im back", "hello again", "good day to you",
            "hey how's it going", "morning assistant", "hi there assistant",
        ],
        ["hey how are you", "hi again", "good day", "hello!!", "yo assistant", "hi is anyone there", "hey good morning", "hello good afternoon"],
    ),
    "thanks": (
        [
            "thanks", "thank you", "thanks a lot", "appreciate it",
            "thank you so much", "ty", "thanks for the help",
            "cool thanks", "great, thank you", "thanks buddy",
            "much appreciated", "perfect thank you", "awesome thanks",
            "tysm", "thx", "thnx", "great thanks a ton", "thanks man",
            "you're a lifesaver thanks", "thanks that helped",
            "perfect, appreciated", "nice one thanks", "thank u",
            "thanks so much for the info", "brilliant thank you",
        ],
        ["thank you very much", "thanks so much for that", "appreciated!", "thanks a bunch", "many thanks", "thank you kindly"],
    ),
    "goodbye": (
        [
            "bye", "goodbye", "see you later", "talk to you later",
            "bye bye", "gotta go", "see ya", "later", "cya",
            "that's all bye", "im done bye", "exiting now bye",
            "ok bye", "alright im leaving", "see you around",
            "gtg bye", "done here bye", "closing this bye",
            "thats it for now bye", "ttyl", "im off", "leaving now",
            "ok i'm done thanks bye",
        ],
        ["see you soon", "gotta run bye", "alright bye now", "catch you later", "ok gotta go now", "signing off"],
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
            "is there an empty slot i can use", "free slots?", "any parking left",
            "is parking full", "slots available", "check availability please",
            "how full is the parking lot", "any spots open right now",
            "what's open right now", "is there room to park my car",
            "can i park here right now", "how many empty slots",
            "any slots left for bikes", "is there a free ev slot",
            "what is the rate for disabled parking", "how much per hour for standard",
        ],
        [
            "got any open spots", "can i find a free slot",
            "what's the rate for ev slots", "is parking full today",
            "any parking free right now", "how many spots left",
            "can you check current availability", "is there space for my car",
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
            "when's the best time to come park", "what hours should i avoid",
            "least busy time to park", "peak parking hours",
            "busiest time of day for parking", "when do most people park here",
            "average time people stay parked", "most popular parking slots",
            "trends in parking usage", "when does parking get crowded",
        ],
        [
            "when is it quietest here", "what hours have the most demand",
            "give me the busy times", "typical session duration?",
            "what days get the most traffic", "when's parking emptiest",
            "which slots get used most often", "how long do people usually park",
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
            "my bookings please", "do i have a booking right now",
            "what did i book", "show me my reservations",
            "any active reservation for me", "when is my booking",
            "list all my bookings", "my booking status",
            "have i got anything booked", "check if i have a slot booked",
            "how many slots have i booked", "how many slots did i book",
            "which slots are booked by me", "which slots have i booked",
            "which slot did i book", "which slots had i booked",
            "how many bookings do i have", "how many times have i booked a slot",
            "count of my bookings", "how many slots do i currently have booked",
            "how long have i had my car parked", "how long has my car been parked",
            "how much time have i parked my car for", "how many hours has my car been parked",
            "how many days has my car been parked", "how long is my current booking",
            "duration of my current booking", "how much time is left on my booking",
            "for how long have i booked my slot", "how long did i park my car for",
            "since when is my car parked", "how many slots did i reserve",
            "how much time i put my car", "how many days i put my car",
            "how many slots was booked by me", "how many slots have been booked by me",
            "how long has my vehicle been in the slot", "how many hours have i been parked",
        ],
        [
            "pull up my reservations", "what have i booked so far",
            "any pending bookings for me", "check my parking history",
            "do i currently have a slot booked", "show me what i've reserved",
            "which slot have i reserved", "how many spots have i booked so far",
            "how long has my vehicle been parked", "how many hours have i had my car parked",
            "count how many bookings i've made", "how many slots am i currently holding",
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
            "my vehicles", "show my cars", "what vehicles are registered to me",
            "how many vehicles have i saved", "show my vehicle details",
            "check my car registration", "list my saved cars and bikes",
        ],
        [
            "show me the vehicles tied to my profile", "any bikes registered to me",
            "display my current vehicle list", "what vehicles have i already added",
            "how many cars do i have on file", "check what vehicles i've registered",
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
            "revenue this month", "how much have we made so far",
            "what's our total earnings", "give me the money numbers",
            "show income report", "total revenue generated",
            "how much did parking bring in", "monthly revenue breakdown",
        ],
        [
            "how much did we earn today", "show total collections",
            "what's our revenue looking like", "give me the income breakdown",
            "how much money has parking made", "what's the total revenue so far",
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
            "how many total accounts", "user stats please", "show me user numbers",
            "how many people use the system", "total registered users",
            "how many accounts are active vs inactive",
        ],
        [
            "how many people are registered", "give me the user breakdown",
            "how many active accounts do we have", "count of staff vs users",
            "total number of users in the system", "how many admins do we have",
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
            "how do bookings work", "can i reserve a spot ahead of time",
            "what's the max number of active bookings", "how soon does a booking expire",
            "booking rules", "how far in advance can i book",
            "is there a limit on bookings", "explain how to reserve parking",
            "can i book more than one slot", "can i book more than 1 slot",
            "can i book 2 slots at once", "can i book two slots",
            "can i have more than one booking at a time", "can i book another slot while i already have one booked",
            "can i book a second slot before checking into the first", "am i allowed multiple bookings at once",
            "can i hold two bookings at the same time", "is there a limit to how many slots i can book",
            "can i reserve more than one spot", "how many slots can i book at once",
            "can i book another slot right after booking one", "can i make a second booking before check-in",
            "can i book another slot after booking a slot", "can i book a second slot",
            "can i book more than 2 slots", "can i book multiple slots",
            "can i book 3 slots", "is booking more than one slot allowed",
        ],
        [
            "walk me through booking a slot", "can i pre-book for next week",
            "what's the deadline before a booking expires", "rules around reserving a spot",
            "how many active bookings am i allowed", "what's the process to book ahead",
            "can i reserve two slots at the same time", "am i limited to one booking at a time",
            "can i book a second spot before checking in to the first", "is there a cap on simultaneous bookings",
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
            "is there a fee to cancel a booking", "how to undo my booking",
            "cancel my reservation", "what's the cancellation policy",
            "can i get my money back if i cancel", "steps to cancel my slot",
        ],
        [
            "steps to cancel a reservation", "can i get a refund if i cancel",
            "does cancelling my booking cost money", "can i cancel once i'm checked in",
            "is cancelling free", "how do refunds work for cancellations",
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
            "check in process", "how do i check in", "explain check in",
            "what do i do to check in", "check in steps",
        ],
        [
            "who handles check in for parking", "do i check in myself or staff does",
            "what's the check-in procedure for a booking", "how does my booking get checked in",
            "what happens when i arrive to check in", "how long do i have to check in",
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
            "checkout process", "how do i get billed", "billing explained",
            "how do i pay for parking", "what's my final bill",
        ],
        [
            "how do parking fees get calculated", "explain how billing works at checkout",
            "how do i get billed for parking", "what's the smallest amount i can be charged",
            "how is the final amount worked out", "do i get a receipt automatically",
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
            "add a vehicle", "how many vehicles can i save", "edit vehicle info",
            "remove a car from my account", "what vehicle categories exist",
        ],
        [
            "guide for adding a vehicle to my account", "how do i remove a vehicle entry",
            "what vehicle categories does the app support", "steps to edit vehicle details",
            "can i change my vehicle's category later", "how many cars am i allowed to save",
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
            "reset password", "update profile", "change my name",
            "how do i update account settings", "delete my profile",
        ],
        [
            "how do i update my personal profile info", "steps to delete my account for good",
            "how do i change my account security settings", "how do i edit my profile photo",
            "can i recover my account after deleting it", "how do i reset my login credentials",
        ],
    ),
    "scan_plate_help": (
        [
            "how do i scan a license plate", "how does plate scanning work",
            "can i take a photo of my plate instead of typing it",
            "the plate scanner isn't reading my plate", "how to use the camera to add a vehicle",
            "scan my number plate automatically", "auto fill registration number",
            "plate scan not working", "camera scan help", "how to photograph my plate",
            "use camera for registration number",
        ],
        [
            "how does the camera scan feature work", "tips for scanning a plate clearly",
            "can i photograph my plate to register it", "why isn't my plate scan working",
        ],
    ),
    "staff_checkin_process": (
        [
            "how do i check in a visitor as staff", "staff check in console instructions",
            "how do i verify a vehicle at check in", "steps for staff to check someone in",
            "how do i find a user's pending booking", "check in console guide for staff",
            "as staff how do i process a check in", "how do i confirm check in for a user",
            "staff check in guide", "how to check in a user's car",
            "checking in bookings as staff",
        ],
        [
            "walk me through the staff check-in flow", "how do i verify someone at check in",
            "staff steps for checking a car in", "how do i find pending check ins as staff",
        ],
    ),
    "staff_checkout_process": (
        [
            "how do i check out a vehicle as staff", "staff checkout console instructions",
            "how do i generate a receipt for a user", "steps for staff to check someone out",
            "how do i confirm checkout and calculate the bill", "checkout console guide for staff",
            "as staff how do i process a checkout", "how do i close out an active booking as staff",
            "staff checkout guide", "how to check out a user's car",
            "processing a checkout as staff",
        ],
        [
            "how do i close out an active booking",
            "walk me through the staff checkout flow",
            "staff steps for checking a car out", "how do i bill a user at checkout as staff",
        ],
    ),
    "admin_slot_management": (
        [
            "how do i add a new parking slot", "how do i change a slot's hourly rate",
            "how do i deactivate a slot", "how do i edit slot type or location",
            "admin guide to managing slots", "how do i mark a slot as ev charging",
            "how do i set up a new faculty slot",
            "add a new slot", "edit slot rate", "deactivate a parking slot",
            "how do i manage slots as admin",
        ],
        [
            "steps to add a slot as admin", "how do i update a slot's rate",
            "how do i take a slot out of service", "how do i change a slot's location as admin",
        ],
    ),
    "admin_user_management": (
        [
            "how do i change a user's role", "how do i promote a user to staff",
            "how do i deactivate a user account", "how do i make someone an admin",
            "admin guide to managing users", "how do i activate a suspended account",
            "promote a user", "change someone's role", "deactivate an account as admin",
            "manage users as admin",
        ],
        [
            "steps to change someone's role", "how do i disable a user's account",
            "how do i give staff access to a user", "how do i reactivate a deactivated user",
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
            "what's the score of the game", "tell me about yourself",
            "who won the world cup", "how tall is mount everest",
            "what's your opinion on politics", "can you order me a pizza",
            "what time is it in tokyo", "write code for me",
            "what's the best programming language", "tell me a riddle",
            "who created you", "are you conscious",
        ],
        [
            "play a song", "translate this to hindi",
            "give me the latest headlines", "can you do my math homework",
            "what's the weather like tomorrow", "tell me something funny",
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