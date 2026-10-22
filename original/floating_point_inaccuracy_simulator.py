#good luck debugging this, future me
from tkinter import *
from tkinter import messagebox
from math import log
from time import time

import json
import os
import tempfile

screen=Tk()
screen.title('floating point inaccuracy simulator')

#THIS GAME WAS MADE TO TAKE YEARS TO FINISH.
#DO NOT EVEN TRY.
#with that said,

won=False

score=0
click_power=0.005
score_per_second=0

click_upgrade_index=1
sps_upgrade_index=1

prestige_points=0
lifetime_PP=0
cheaper_upgrades_index=0
sps_prestige_upgrade_index=0

milestone_order=[1,2,4,8,16,32,64]#, repeat but *100
score_ms_index=0 
upgrade_ms_index=0
prestige_ms_index=0

#stats for achievements (may be displayed in UI in the future)
time_elapsed=0
total_clicks=0
lifetime_prestiges=0
broke_counter=0 # number of times the player clicked an upgrade without being able to afford it
upgrades_paid_for=0
run_clicks=0 #clicks made in this run

click_avm_boost=0
sps_avm_boost=0
general_avm_boost=0

achievements=[ 
    #order goes [title, description, lambda: variable in question, lambda variable: quota for variable, 
    #lambda : reward in score, [permanent click boost, sps boost, general boost], reward in PP, unlocked]
    #in no specific order
    #well actually its the order i came up with them
    #which is pretty arbitrary

    ['the name of the game',
     'find out that computers aren\'t good at floating-point arithmetic',
     lambda: score,
     lambda score: score>=0.030000000000000002,
     lambda score: 0.00000000000000001,
     [0,0,0],
     0,
     False
    ],
    ['alert the staff',
     'somehow get negative score???',
     lambda: score,
     lambda score: score<0,
     lambda score: 100,
     [0,0,0],
     5,
     False
    ],
    ['go touch grass',
     'play for 24 hours',
     lambda: time_elapsed,
     lambda time: time>=86400,
     lambda score: 0,
     [0,0,0.05],
     1,
     False
    ],
    ['making progress',
     '10% of the way there',
     lambda: max(int(log(score,10)/63*1000)/10,0) if score>=1 else 0,
     lambda progress: progress>=10,
     lambda score: 0,
     [0, 0.05,0.05],
     5,
     False
    ],
    ['carpal tunnel syndrome',
     'click 100000 times',
     lambda: total_clicks,
     lambda total_clicks: total_clicks>=100000,
     lambda score: score*0.1,
     [0,0.01,0],
     0,
     False
    ],
    ['hoarder',
     'have at least 100 prestige points at a time',
     lambda: prestige_points,
     lambda PP: PP>=100,
     lambda score: 0,
     [0.01,0,0],
     0,
     False
    ],
    ['beginning of the end',
     'click for the first time. you will do this many, many more times.',
     lambda: total_clicks,
     lambda clicks: clicks>=1,
     lambda score: 0,
     [0,0,0],
     0,
     False
    ],
    ['time wasters: wasters of time',
     'get to 1000 score without prestiging',
     lambda: score,
     lambda score: score>=1000 and lifetime_PP==0,
     lambda score: -1,
     [0,0,0],
     0,
     False 
    ],
    ['lol',
     'you have officially been permanently locked out of an achievement. we wont tell you what.',
     lambda: lifetime_PP,
     lambda PP: PP>=1,
     lambda score: +0,
     [0,0,-0.001],
     0,
     False,
    ],
    ['i got you a gift!',
     'a small gift, just for you =)',
     lambda: time_elapsed,
     lambda time: time>=4924, #this is supposed to just come as a suprise
     lambda score: -0,
     [0,0,0.01],
     1,
     False
    ],
    ['stop.',
     'playing this game is dangerous, you can still leave.',
     lambda: time_elapsed,
     lambda time: time>=3600,
     lambda score: 0,
    [0,0,0],
     0,
    False,
    ],
    ['it\'s too late...',
     'you\'ve been at this for a year now. you can\'nt stop anymore, so might as well help you out.',
     lambda: time_elapsed,
     lambda time: time>=86400*365,
     lambda score: 0,
     [0,0.05,0.05],
     10,
     False
    ],
    ['retirement fees',
     'A DECADE??',
     lambda: time_elapsed,
     lambda time: time>=86400*365*10,
     lambda score: score,
     [0,0.05,0.05],
     100,
     False
    ],
    ['autoclicker',
     'click 1 million times',
     lambda: total_clicks,
     lambda clicks: clicks>=1000000,
     lambda score: 0,
     [0.01,0,0.005],
     0,
     False
    ],
    ['cheater!',
     'hey. i know youre using an autoclicker. stop it.',
     lambda: total_clicks/max(time_elapsed,1),
     lambda cps: cps>20,
     lambda score: -0.2*score,
     [-0.1, 0.01, 0],
     0,
     False
    ],
    ['bankruptcy',
     'click 100 upgrades without being able to afford them',
     lambda: broke_counter,
     lambda counter: counter>=100,
     lambda score: 0,
     [0,0,0],
     0,
     False
    ],
    ['need a loan?',
     'click 1000 upgrades without being able to afford them',
     lambda: broke_counter,
     lambda counter: counter>=1000,
     lambda score: 0.1*score,
     [-0.01,0,0],
     0,
     False
    ],
    ['100 percenting floating point inaccuracy simulator any % speedrun',
     'get every achievement (besides this one)',
     lambda: achievements,
     lambda a: all(achievement[7] for achievement in a if achievement[0] != '100 percenting floating point inaccuracy simulator any % speedrun'),
     lambda score: 0,
     [0,0,0.05],
     50,
     False,
    ],
    ['milestone milestone 1',
     'get 10 milestones',
     lambda: score_ms_index+upgrade_ms_index+prestige_ms_index,
     lambda milestones: milestones>=10,
     lambda score: 0,
     [0,0,0.01],
     1,
     False
    ],
    ['milestone milestone 2',
     'get 100 milestones',
     lambda: score_ms_index+upgrade_ms_index+prestige_ms_index,
     lambda milestones: milestones>=100,
     lambda score: 0,
     [0,0,0.01],
     2,
     False
    ],
    ['milestone milestone 3',
     'get 1000 milestones\ni dont think this is possible.',
     lambda: score_ms_index+upgrade_ms_index+prestige_ms_index,
     lambda milestones: milestones>=1000,
     lambda score: 0,
     [0,0,0.01],
     5,
     False
    ],
    ['halfway there!',
     'get 50% progress',
     lambda: max(int(log(score,10)/63*1000)/10,0) if score>=1 else 0,
     lambda progress: progress>=50,
     lambda score: 0,
     [0,0,0.02],
     3,
     False
    ],
    ['free sample',
     'buy an upgrade for free',
     lambda: upgrades_paid_for,
     lambda upgrades: upgrades<click_upgrade_index+sps_upgrade_index-2,
     lambda score: 2.5,
     [0,0,0],
     1,
     False
    ],
    ['filler text',
     'im bored so heres a gift',
     lambda: total_clicks,
     lambda clicks: clicks>=194745,
     lambda score: score*0.01,
     [0.01,0,0],
     3,
     False
    ]

]
special_achievements=[ #achievements that aren't checked every second or have a special condition
    ['why?',
     'prestige with less than 10 score and reset all your progress for nothing',
     lambda: score,
     lambda score: score<10,
     lambda score: 0,
     [0,0,-0.01],
     0,
     False
    ],
    ['alright, i give up, you win',
     'this achievement shouldn\'t be possible to get. if you did, you have exceeded my estimated play time tenfold.\n\
        i am so sorry for ruining your life.',
     lambda: time_elapsed,
     lambda time: time>=86400*365*50,
     lambda score: 10**63,
     [1,1,1],
     10**20,
     False
    ],
    ['take a break.',
     'go outside. drink some water. touch grass. whatever. just take a break.',
     lambda: broke_counter,
     lambda broke: broke>=42,
     lambda score: 0,
    [0,0,0],
     0,
    False
    ],
    ['the average costco:',
     'prestige with at least 10 score without paying for a single upgrade',
     lambda: upgrades_paid_for,
     lambda upgrades: upgrades==0,
     lambda score: 0,
     [0.01,0,0],
     3,
     False
    ],
    ['lazy.',
     'prestige (with more than 10 score) without clicking the increment button at all',
     lambda: run_clicks,
     lambda clicks: clicks==0,
     lambda score: 0,
     [0.001,-0.001,0],
     0,
     False
    ]
]
SAVE_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "save.json"
)

def save_game():
    data = {
        "won": won,
        "score": score,
        "click_power": click_power,
        "score_per_second": score_per_second,

        "click_upgrade_index": click_upgrade_index,
        "sps_upgrade_index": sps_upgrade_index,

        "prestige_points": prestige_points,
        "lifetime_PP": lifetime_PP,
        "cheaper_upgrades_index": cheaper_upgrades_index,
        "sps_prestige_upgrade_index": sps_prestige_upgrade_index,

        "score_ms_index": score_ms_index,
        "upgrade_ms_index": upgrade_ms_index,
        "prestige_ms_index": prestige_ms_index,

        # Achievement statistics
        "time_elapsed": time_elapsed,
        "total_clicks": total_clicks,
        "lifetime_prestiges": lifetime_prestiges,

        # Permanent achievement boosts
        "click_avm_boost": click_avm_boost,
        "sps_avm_boost": sps_avm_boost,
        "general_avm_boost": general_avm_boost,

        # Achievement unlock status
        "achievements_unlocked": [a[7] for a in achievements],
        "special_achievements_unlocked": [
            a[7] for a in special_achievements
        ]
    }

    temporary_path = None

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=os.path.dirname(SAVE_FILE),
            delete=False,
            suffix=".tmp"
        ) as file:
            json.dump(data, file, indent=4)
            temporary_path = file.name

        os.replace(temporary_path, SAVE_FILE)

    except (OSError, TypeError, ValueError) as error:
        print("Could not save game:", error)

        if temporary_path and os.path.exists(temporary_path):
            try:
                os.remove(temporary_path)
            except OSError:
                pass


def load_game():
    global won, score, click_power, score_per_second
    global click_upgrade_index, sps_upgrade_index
    global prestige_points, lifetime_PP
    global cheaper_upgrades_index, sps_prestige_upgrade_index
    global score_ms_index, upgrade_ms_index, prestige_ms_index
    global time_elapsed, total_clicks, lifetime_prestiges
    global click_avm_boost, sps_avm_boost, general_avm_boost

    if not os.path.exists(SAVE_FILE):
        return

    try:
        with open(SAVE_FILE, "r", encoding="utf-8") as file:
            data = json.load(file)

        won = bool(data.get("won", False))
        score = float(data.get("score", 0))
        click_power = float(data.get("click_power", 0.005))
        score_per_second = float(data.get("score_per_second", 0))

        click_upgrade_index = int(data.get("click_upgrade_index", 1))
        sps_upgrade_index = int(data.get("sps_upgrade_index", 1))

        prestige_points = int(data.get("prestige_points", 0))
        lifetime_PP = int(data.get("lifetime_PP", prestige_points))

        cheaper_upgrades_index = int(
            data.get("cheaper_upgrades_index", 0)
        )
        sps_prestige_upgrade_index = int(
            data.get("sps_prestige_upgrade_index", 0)
        )

        score_ms_index = int(data.get("score_ms_index", 0))
        upgrade_ms_index = int(data.get("upgrade_ms_index", 0))
        prestige_ms_index = int(data.get("prestige_ms_index", 0))

        # Restore achievement statistics
        time_elapsed = int(data.get("time_elapsed", 0))
        total_clicks = int(data.get("total_clicks", 0))
        lifetime_prestiges = int(data.get("lifetime_prestiges", 0))

        # Restore permanent achievement boosts
        click_avm_boost = float(data.get("click_avm_boost", 0))
        sps_avm_boost = float(data.get("sps_avm_boost", 0))
        general_avm_boost = float(data.get("general_avm_boost", 0))

        # Restore ordinary achievement unlocks
        saved_achievements = data.get("achievements_unlocked", [])
        for i, unlocked in enumerate(saved_achievements):
            if i < len(achievements):
                achievements[i][7] = bool(unlocked)

        # Restore special achievement unlocks
        saved_special = data.get(
            "special_achievements_unlocked", []
        )
        for i, unlocked in enumerate(saved_special):
            if i < len(special_achievements):
                special_achievements[i][7] = bool(unlocked)

        print("Game loaded!")

    except (
        OSError,
        json.JSONDecodeError,
        TypeError,
        ValueError,
        OverflowError
    ) as error:
        print("Could not load save:", error)
        print("Starting a new game.")


def force_mac_refresh():
    x, y = screen.winfo_x(), screen.winfo_y()
    screen.geometry(f"+{x+1}+{y}")
    screen.after(5, lambda: screen.geometry(f"+{x}+{y}"))

def increment_func():
    global score, total_clicks, run_clicks
    score+=click_power*(1+click_avm_boost)*(1+general_avm_boost)*(1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)
    total_clicks+=1
    run_clicks+=1
    check_achievments()
    score_label.config(text='score: '+str(score))

def per_sec_update():
    global score, won, time_elapsed
    time_elapsed+=1
    score+=score_per_second*(1+sps_avm_boost)*(1+general_avm_boost)*(1+0.01*sps_prestige_upgrade_index*prestige_points)*(1+0.01*upgrade_ms_index)*(1+0.01*prestige_ms_index)
    score_label.config(text='score: '+str(score))
    prestige_button.config(text='reset all other progress for '+str(max(int(log(score,10)), 0) if score>=1 else 0)+' prestige points')
    check_milestones()
    check_achievments()
    if not won:
        check_achievments(1)
    progress_label.config(text='progress: '+str(max(int(log(score,10)/63*1000)/10,0) if score>=1 else 0)+'%')
    if score >= 10**63 and not won:
        won=True
        screen.after(1000,progress_label.destroy)
        win_label.config(text='u already won')
        messagebox.showinfo(message='wow u actually did it congrats on wasting years of your life on this')
    save_game()
    screen.after(1000, per_sec_update)

def upgrade_click():
    global click_power, click_upgrade_index, score, broke_counter, upgrades_paid_for
    # cost=int(1.5**(max(click_upgrade_index-36, 0) + 2*(click_upgrade_index-1))*50-20) 
    cost=int(2**click_upgrade_index * 0.9**cheaper_upgrades_index)
    if score>=cost:

        if cost!=0:
            upgrades_paid_for+=1
            
        click_power+=0.005
        click_upgrade_index+=1
        score-=cost

        new_cost=int(2**click_upgrade_index * 0.9**cheaper_upgrades_index)
        score_label.config(text='score: '+str(score))
        click_power_label.config(text='click power: '+str(click_power*(1+click_avm_boost)*(1+general_avm_boost)*(1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)))
        upgrade_click_button.config(text='upgrade clicking \n cost: '+str(new_cost))
    else:
        broke_counter+=1
        screen.after(35000, lambda: check_achievments(2))
        return -1
    #force_mac_refresh()

def upgrade_sps():
    global score_per_second, sps_upgrade_index, score, broke_counter, upgrades_paid_for
    cost=int(1.5**sps_upgrade_index * 0.9**cheaper_upgrades_index)
    if score>=cost:

        if cost!=0:
            upgrades_paid_for+=1

        score_per_second+=0.002 #update everything
        sps_upgrade_index+=1
        score-=cost

        new_cost=int(1.5**sps_upgrade_index * 0.9**cheaper_upgrades_index)
        score_label.config(text='score: '+str(score))
        sps_label.config(text='score per second: '+str(score_per_second*(1+sps_avm_boost)*(1+general_avm_boost)*(1+0.01*sps_prestige_upgrade_index*prestige_points)*\
    (1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)))
        upgrade_sps_button.config(text='upgrade score per second \n cost: '+str(new_cost))
    else:
        broke_counter+=1
        screen.after(35000, lambda: check_achievments(2))
        return -1
    #force_mac_refresh()

def prestige():
    global score, prestige_points, click_upgrade_index, click_power, sps_upgrade_index,\
    score_per_second, lifetime_PP, lifetime_prestiges, upgrades_paid_for, run_clicks
    check_achievments(0)
    if score>=10:
        check_achievments(3)
        check_achievments(4)
    points=max(int(log(score,10)), 0) if score>=1 else 0

    score=0
    click_power=0.005
    score_per_second=0

    click_upgrade_index=0
    sps_upgrade_index=0

    prestige_points+=points
    lifetime_PP+=points
    lifetime_prestiges+=1

    upgrades_paid_for=0
    run_clicks=0

    score_label.config(text='score: 0')
    click_power_label.config(text='click power: '+str(click_power*(1+click_avm_boost)*(1+general_avm_boost)*(1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)))
    sps_label.config(text='score per second: '+str(score_per_second*(1+sps_avm_boost)*(1+general_avm_boost)*(1+0.01*sps_prestige_upgrade_index*prestige_points)*\
    (1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)))
    upgrade_click_button.config(text='upgrade clicking \n cost: '+str(int(2**click_upgrade_index * 0.9**cheaper_upgrades_index)))
    upgrade_sps_button.config(text='upgrade score per second \n cost: '+str(int(1.5**sps_upgrade_index * 0.9**cheaper_upgrades_index)))
    prestige_button.config(text='reset all other progress for 0 prestige points')
    prestige_points_label.config(text='prestige points: '+str(prestige_points))

def prestige_upgrades(upgrade):
    global score, prestige_points, cheaper_upgrades_index, sps_prestige_upgrade_index, broke_counter
    if prestige_points<1:
        broke_counter+=1
        screen.after(35000, lambda: check_achievments(2))
        messagebox.showinfo(message='you do not have enough prestige points for that.')
        return
    prestige_points-=1
    prestige_points_label.config(text='prestige points: '+str(prestige_points))
    if upgrade==0: #make all upgrades 10% cheaper (mutiplicative)
        cheaper_upgrades_index+=1
    elif upgrade==1: #gain 25% of current score
        score*=1.25*(1+0.01*prestige_ms_index)
        score_label.config(text='score: '+str(score))
        check_milestones()
    elif upgrade==2: #instant 10 minutes of passive income
        score+=score_per_second*(1+sps_avm_boost)*(1+general_avm_boost)*600*(1+0.01*sps_prestige_upgrade_index*prestige_points)*\
        (1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)
        score_label.config(text='score: '+str(score))
    elif upgrade==3: #gain 1% more sps for every remaining prestige point (stacks additively)
        sps_prestige_upgrade_index+=1

def check_milestones():
    global score_ms_index, upgrade_ms_index, prestige_ms_index

    score_pos=score_ms_index%7
    upgrade_pos=upgrade_ms_index%7
    prestige_pos=prestige_ms_index%7

    score_cycle=score_ms_index//7
    upgrade_cycle=upgrade_ms_index//7
    prestige_cycle=prestige_ms_index//7

    if score>=milestone_order[score_pos]*100**score_cycle:
        messagebox.showinfo(message='you have achieved score milestone #'+str(score_ms_index+1)+'. click income increased by 1%.')
        score_ms_index+=1
        check_milestones()
        click_power_label.config(text='click power: '+str(click_power*(1+click_avm_boost)*(1+general_avm_boost)*(1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)))

    if click_upgrade_index+sps_upgrade_index-2>=milestone_order[upgrade_pos]*100**upgrade_cycle:
        messagebox.showinfo(message='you have achieved upgrade milestone #'+str(upgrade_ms_index+1)+'. sps income increased by 1%.')
        upgrade_ms_index+=1
        check_milestones()
        sps_label.config(text='score per second: '+str(score_per_second*(1+sps_avm_boost)*(1+general_avm_boost)*(1+0.01*sps_prestige_upgrade_index*prestige_points)*\
        (1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)))

    if lifetime_PP>=milestone_order[prestige_pos]*100**prestige_cycle:
        messagebox.showinfo(message='you have achieved prestige milestone #'+str(prestige_ms_index+1)+'. all income increased by 1%.')
        prestige_ms_index+=1
        check_milestones()
        click_power_label.config(text='click power: '+str(click_power*(1+click_avm_boost)*(1+general_avm_boost)*(1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)))
        sps_label.config(text='score per second: '+str(score_per_second*(1+sps_avm_boost)*(1+general_avm_boost)*(1+0.01*sps_prestige_upgrade_index*prestige_points)*\
        (1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)))

def check_achievments(index=None):
    global score, achievements, special_achievements, prestige_points, lifetime_PP, click_avm_boost, sps_avm_boost, general_avm_boost
    for i,a in enumerate(achievements):
        if a[3](a[2]()) and not a[7]:
            messagebox.showinfo(title=a[0], message=a[1]+f'\n\nrewards: {a[4](score)} score, {a[5][0]*100}% boost to clicking income, '\
            +f'{a[5][1]*100}% boost to passive income, {a[5][2]*100}% boost to all income, {a[6]} prestige points.')
            achievements[i][7]=True
            score+=a[4](score)
            click_avm_boost+=a[5][0]
            sps_avm_boost+=a[5][1]
            general_avm_boost+=a[5][2]
            prestige_points+=a[6]
            lifetime_PP+=a[6]

    if index!=None and not special_achievements[index][7]:
        a=special_achievements[index]
        if a[3](a[2]()) and not a[7]:
            messagebox.showinfo(title=a[0], message=a[1]+f'\n\nrewards: {a[4](score)} score, {a[5][0]*100}% boost to clicking income, '\
            +f'{a[5][1]*100}% boost to passive income, {a[5][2]*100}% boost to all income, {a[6]} prestige points.')
            special_achievements[index][7]=True
            score+=a[4](score)
            click_avm_boost+=a[5][0]
            sps_avm_boost+=a[5][1]
            general_avm_boost+=a[5][2]
            prestige_points+=a[6]
            lifetime_PP+=a[6]
    
def goto(menu):
    if menu==0:
        main_frame.tkraise()
    elif menu==1:
        upgrade_frame.tkraise()
    elif menu==2:
        prestige_frame.tkraise()
    force_mac_refresh()

load_game()

main_frame=Frame(screen)
score_label=Label(main_frame, text='score: '+str(score))
increment_button=Button(main_frame, text='increment',command=increment_func)
click_power_label=Label(main_frame, text='click power: '+str(click_power*(1+click_avm_boost)*(1+general_avm_boost)*(1+click_avm_boost)*(1+general_avm_boost)*(1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)))
sps_label=Label(main_frame, text='score per second: '+str(score_per_second*(1+sps_avm_boost)*(1+general_avm_boost)*\
    (1+0.01*sps_prestige_upgrade_index*prestige_points)*\
    (1+0.01*score_ms_index)*(1+0.01*prestige_ms_index)))
win_label=Label(main_frame,text='get 10^63 (one vigintillion) score to win')
progress_label=Label(main_frame,text='progress: '+str(max(int(log(score,10)/63*1000)/10,0) if score>=1 else 0)+'%')
goto1=Button(main_frame, text='go to upgrade menu', command=lambda: goto(1))

upgrade_frame=Frame(screen)
upgrade_click_button=Button(upgrade_frame, text='upgrade clicking \n cost: '+str(int(2**click_upgrade_index * 0.9**cheaper_upgrades_index)), command=\
    lambda: None if upgrade_click()!=-1 else messagebox.showerror(message='you do not have enough score for this.'))
upgrade_sps_button=Button(upgrade_frame,text='upgrade score per second \n cost: '+str(int(1.5**sps_upgrade_index * 0.9**cheaper_upgrades_index)), command=\
    lambda: None if upgrade_sps()!=-1 else messagebox.showerror(message='you do not have enough score for this.'))
save_button=Button(upgrade_frame, text='save game', command=save_game)
goto2=Button(upgrade_frame, text='go to prestige menu', command=lambda: goto(2))
goto0=Button(upgrade_frame, text='go to main menu', command=lambda: goto(0))

prestige_frame=Frame(screen)
prestige_button=Button(prestige_frame, text='reset all other progress for 0 prestige points', command=prestige)
prestige_points_label=Label(prestige_frame, text='prestige points: '+str(prestige_points))
cheaper_upgrades_button=Button(prestige_frame, text='all upgrades 10% cheaper', command=lambda: prestige_upgrades(0))
score_multiplier_button=Button(prestige_frame, text='gain 25% of current score', command=lambda: prestige_upgrades(1))
time_skip_button=Button(prestige_frame, text='gain 10 minutes of\npassive income instantly', command=lambda: prestige_upgrades(2))
sps_prestige_upgrade_button=Button(prestige_frame, text='+1% passive income\nper prestige point \nper level', command=lambda: prestige_upgrades(3))    
goto0_=Button(prestige_frame, text='go to main menu', command=lambda: goto(0))

main_frame.grid(row=0,column=0, sticky='nsew')

score_label.grid(row=0,column=0,columnspan=2)
click_power_label.grid(row=1,column=0)
sps_label.grid(row=1, column=1)
increment_button.grid(row=2,column=0)
win_label.grid(row=3,column=0)
progress_label.grid(row=3,column=1)
goto1.grid(row=2, column=1)

upgrade_frame.grid(row=0,column=0, sticky='nsew')

upgrade_click_button.grid(row=1, column=0)
upgrade_sps_button.grid(row=1, column=1)
goto2.grid(row=2,column=1)
goto0.grid(row=2,column=0)
save_button.grid(row=3,column=2)

prestige_frame.grid(row=0, column=0, sticky='nsew')

prestige_button.grid(row=0, column=0, columnspan=4)
prestige_points_label.grid(row=1,column=0, columnspan=4)
cheaper_upgrades_button.grid(row=2,column=0)
score_multiplier_button.grid(row=2,column=1)
time_skip_button.grid(row=3,column=0)
sps_prestige_upgrade_button.grid(row=3,column=1)
goto0_.grid(row=4,column=1)

per_sec_update()
#force_mac_refresh()
goto(0)
screen.mainloop()