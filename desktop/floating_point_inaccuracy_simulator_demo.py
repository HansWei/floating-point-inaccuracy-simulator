from tkinter import *
from tkinter import messagebox
from math import log

screen=Tk()
screen.title('floating point inaccuracy simulator (demo)')

#this is the demo of the nightmare u got urself into when u told me u like slow incrementals
#with that said,

won=False

score=0
click_power=0.1
score_per_second=0

click_upgrade_index=1
sps_upgrade_index=1

prestige_points=0
lifetime_PP=0
cheaper_upgrades_index=0

#stats for achievements (same as the full game)
time_elapsed=0
total_clicks=0
broke_counter=0 # number of times the player clicked an upgrade without being able to afford it
upgrades_paid_for=0
run_clicks=0 #clicks made in this run

click_avm_boost=0
sps_avm_boost=0
general_avm_boost=0

achievements=[
    #same format as the full game:
    #[title, description, lambda: variable in question, lambda variable: quota for variable,
    #lambda : reward in score, [permanent click boost, sps boost, general boost], reward in PP, unlocked]
    #goals are scaled down for the demo (win at 5000 score)

    ['the name of the game',
     'find out that computers aren\'t good at floating-point arithmetic',
     lambda: score,
     lambda score: score>=0.30000000000000004,
     lambda score: 0.00000000000000001,
     [0,0,0],
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
    ['making progress',
     '10% of the way there',
     lambda: score,
     lambda score: score>=500,
     lambda score: 0,
     [0,0.05,0.05],
     0, #no prestige points, so 'time wasters' (1000 score with no prestige points ever) stays possible
     False
    ],
    ['halfway there!',
     'get 50% progress',
     lambda: score,
     lambda score: score>=2500,
     lambda score: 0,
     [0,0,0.02],
     1,
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
     lambda score: 0,
     [0,0,-0.001],
     0,
     False
    ],
    ['hoarder',
     'have at least 10 prestige points at a time',
     lambda: prestige_points,
     lambda PP: PP>=10,
     lambda score: 0,
     [0.01,0,0],
     0,
     False
    ],
    ['carpal tunnel syndrome',
     'click 1000 times',
     lambda: total_clicks,
     lambda total_clicks: total_clicks>=1000,
     lambda score: score*0.1,
     [0,0.01,0],
     0,
     False
    ],
    ['filler text',
     'im bored so heres a gift',
     lambda: total_clicks,
     lambda clicks: clicks>=1947,
     lambda score: score*0.01,
     [0.01,0,0],
     1,
     False
    ],
    ['autoclicker',
     'click 10000 times',
     lambda: total_clicks,
     lambda clicks: clicks>=10000,
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
     [-0.1,0.01,0],
     0,
     False
    ],
    ['i got you a gift!',
     'a small gift, just for you =)',
     lambda: time_elapsed,
     lambda time: time>=492,
     lambda score: 0,
     [0,0,0.01],
     1,
     False
    ],
    ['stop.',
     'playing this game is dangerous, you can still leave.',
     lambda: time_elapsed,
     lambda time: time>=600,
     lambda score: 0,
     [0,0,0],
     0,
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
    ['bankruptcy',
     'click 100 upgrades without being able to afford them',
     lambda: broke_counter,
     lambda broke: broke>=100,
     lambda score: 0,
     [0,0,0],
     0,
     False
    ],
    ['need a loan?',
     'click 1000 upgrades without being able to afford them',
     lambda: broke_counter,
     lambda broke: broke>=1000,
     lambda score: 0.1*score,
     [-0.01,0,0],
     0,
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
    ['100 percenting floating point inaccuracy simulator (demo) any % speedrun',
     'get every achievement (besides this one)',
     lambda: achievements,
     lambda achievements: all(a[7] for a in achievements if a[0]!='100 percenting floating point inaccuracy simulator (demo) any % speedrun'),
     lambda score: 0,
     [0,0,0.05],
     5,
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
     1,
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

def click_income():
    return click_power*(1+click_avm_boost)*(1+general_avm_boost)

def passive_income():
    return score_per_second*(1+sps_avm_boost)*(1+general_avm_boost)

def refresh_labels():
    score_label.config(text='score: '+str(score))
    click_power_label.config(text='click power: '+str(click_income()))
    sps_label.config(text='score per second: '+str(passive_income()))
    prestige_points_label.config(text='prestige points: '+str(prestige_points))

def check_achievments(index=None):
    #same as the full game
    global score, prestige_points, lifetime_PP, click_avm_boost, sps_avm_boost, general_avm_boost
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
    refresh_labels()

def broke():
    global broke_counter
    broke_counter+=1
    screen.after(35000, lambda: check_achievments(1))


def increment_func():
    global score, total_clicks, run_clicks
    score+=click_income()
    total_clicks+=1
    run_clicks+=1
    check_achievments()
    score_label.config(text='score: '+str(score))

def per_sec_update():
    global score, won, time_elapsed
    time_elapsed+=1
    score+=passive_income()
    score_label.config(text='score: '+str(score))
    screen.after(1000, per_sec_update)
    check_achievments()
    if score >= 5000 and not won:
        won=True
        messagebox.showinfo(message='yay u completed the demo of floating point inaccuracy simulator!')

    prestige_button.config(text='reset all other progress for '+str(max(int(log(score,5)), 0) if score>=1 else 0)+' prestige points')

def upgrade_click():
    global click_power, click_upgrade_index, score, upgrades_paid_for
    # cost=int(1.5**(max(click_upgrade_index-36, 0) + 2*(click_upgrade_index-1))*50-20) 
    cost=int(1.6**click_upgrade_index * 0.95**cheaper_upgrades_index)
    if score>=cost:
        if cost!=0:
            upgrades_paid_for+=1
        click_power+=0.05
        click_upgrade_index+=1
        score-=cost

        new_cost=int(1.6**click_upgrade_index * 0.95**cheaper_upgrades_index)
        score_label.config(text='score: '+str(score))
        click_power_label.config(text='click power: '+str(click_income()))
        upgrade_click_button.config(text='upgrade clicking \n cost: '+str(new_cost))
    else:
        broke()
        return -1

def upgrade_sps():
    global score_per_second, score, sps_upgrade_index, upgrades_paid_for
    cost=int(1.4**sps_upgrade_index * 0.95**cheaper_upgrades_index)
    if score>=cost:
        if cost!=0:
            upgrades_paid_for+=1

        score_per_second+=0.15 #update everything
        sps_upgrade_index+=1
        score-=cost

        new_cost=int(1.4**sps_upgrade_index * 0.95**cheaper_upgrades_index)
        score_label.config(text='score: '+str(score))
        sps_label.config(text='score per second: '+str(passive_income()))
        upgrade_sps_button.config(text='upgrade score per second \n cost: '+str(new_cost))
    else:
        broke()
        return -1

def prestige():
    global score, prestige_points, click_upgrade_index, click_power, sps_upgrade_index, score_per_second
    global lifetime_PP, upgrades_paid_for, run_clicks
    check_achievments(0)
    if score>=10:
        check_achievments(2)
        check_achievments(3)
    points=max(int(log(score,5)), 0) if score>=1 else 0

    score=0
    click_power=0.1
    score_per_second=0

    click_upgrade_index=1
    sps_upgrade_index=1

    prestige_points+=points
    lifetime_PP+=points

    upgrades_paid_for=0
    run_clicks=0

    score_label.config(text='score: 0')
    click_power_label.config(text='click power: '+str(click_income()))
    sps_label.config(text='score per second: '+str(passive_income()))
    upgrade_click_button.config(text='upgrade clicking \n cost: 1')
    upgrade_sps_button.config(text='upgrade score per second \n cost: 1')
    prestige_button.config(text='reset all other progress for 0 prestige points')
    prestige_points_label.config(text='prestige points: '+str(prestige_points))

def prestige_upgrades(upgrade):
    global score, prestige_points, cheaper_upgrades_index
    if prestige_points<1:
        broke()
        messagebox.showinfo(message='you do not have enough prestige points for that.')
        return
    prestige_points-=1
    prestige_points_label.config(text='prestige points: '+str(prestige_points))
    if upgrade==0: #make all upgrades 5% cheaper (mutiplicative)
        cheaper_upgrades_index+=1
    elif upgrade==2: #instant 3 minutes of passive income
        score+=passive_income()*180
        score_label.config(text='score: '+str(score))

def goto(menu):
    if menu==0:
        main_frame.tkraise()
    elif menu==1:
        upgrade_frame.tkraise()
    elif menu==2:
        prestige_frame.tkraise()

main_frame=Frame(screen)
score_label=Label(main_frame, text='score: '+str(score))
increment_button=Button(main_frame, text='increment',command=increment_func)
click_power_label=Label(main_frame, text='click power: '+str(click_power))
sps_label=Label(main_frame, text='score per second: '+str(score_per_second))
win_label=Label(main_frame,text='get 5000 score to win')
goto1=Button(main_frame, text='go to upgrade menu', command=lambda: goto(1))

upgrade_frame=Frame(screen)
upgrade_click_button=Button(upgrade_frame, text='upgrade clicking \n cost: 1', command=lambda: None if upgrade_click()!=-1 else messagebox.showerror(message='you do not have enough score for this.'))
upgrade_sps_button=Button(upgrade_frame,text='upgrade score per second \n cost: 1', command=lambda: None if upgrade_sps()!=-1 else messagebox.showerror(message='you do not have enough score for this.'))
goto2=Button(upgrade_frame, text='go to prestige menu', command=lambda: goto(2))
goto0=Button(upgrade_frame, text='go to main menu', command=lambda: goto(0))

prestige_frame=Frame(screen)
prestige_button=Button(prestige_frame, text='reset all other progress for 0 prestige points', command=prestige)
prestige_points_label=Label(prestige_frame, text='prestige points: '+str(prestige_points))
cheaper_upgrades_button=Button(prestige_frame, text='all upgrades 5% cheaper', command=lambda: prestige_upgrades(0))
time_skip_button=Button(prestige_frame, text='gain 3 minutes of\npassive income instantly', command=lambda: prestige_upgrades(2)) 
goto0_=Button(prestige_frame, text='go to main menu', command=lambda: goto(0))

main_frame.grid(row=0,column=0, sticky='nsew')

score_label.grid(row=0,column=0,columnspan=2)
click_power_label.grid(row=1,column=0)
sps_label.grid(row=1, column=1)
increment_button.grid(row=2,column=0)
win_label.grid(row=3,column=0,columnspan=2)
goto1.grid(row=2, column=1)

upgrade_frame.grid(row=0,column=0, sticky='nsew')

upgrade_click_button.grid(row=1, column=0)
upgrade_sps_button.grid(row=1, column=1)
goto2.grid(row=2,column=1)
goto0.grid(row=2,column=0)

prestige_frame.grid(row=0, column=0, sticky='nsew')

prestige_button.grid(row=0, column=0, columnspan=4)
prestige_points_label.grid(row=1,column=0, columnspan=4)
cheaper_upgrades_button.grid(row=2,column=1)
time_skip_button.grid(row=2,column=0)
goto0_.grid(row=4,column=1)

per_sec_update()
goto(0)
screen.mainloop()