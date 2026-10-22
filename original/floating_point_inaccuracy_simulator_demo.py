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
cheaper_upgrades_index=0


def increment_func():
    global score
    score+=click_power
    score_label.config(text='score: '+str(score))

def per_sec_update():
    global score, won
    score+=score_per_second
    score_label.config(text='score: '+str(score))
    screen.after(1000, per_sec_update)
    if score >= 5000 and not won:
        won=True
        messagebox.showinfo(message='yay u completed the demo of floating point inaccuracy simulator!')

    prestige_button.config(text='reset all other progress for '+str(max(int(log(score,5)), 0) if score>=1 else 0)+' prestige points')

def upgrade_click():
    global click_power, click_upgrade_index, score
    # cost=int(1.5**(max(click_upgrade_index-36, 0) + 2*(click_upgrade_index-1))*50-20) 
    cost=int(1.6**click_upgrade_index * 0.95**cheaper_upgrades_index)
    if score>=cost:
        click_power+=0.05
        click_upgrade_index+=1
        score-=cost

        new_cost=int(1.6**click_upgrade_index * 0.95**cheaper_upgrades_index)
        score_label.config(text='score: '+str(score))
        click_power_label.config(text='click power: '+str(click_power))
        upgrade_click_button.config(text='upgrade clicking \n cost: '+str(new_cost))
    else:
        return -1

def upgrade_sps():
    global score_per_second, score, sps_upgrade_index
    cost=int(1.4**sps_upgrade_index * 0.95**cheaper_upgrades_index)
    if score>=cost:

        score_per_second+=0.15 #update everything
        sps_upgrade_index+=1
        score-=cost

        new_cost=int(1.4**sps_upgrade_index * 0.95**cheaper_upgrades_index)
        score_label.config(text='score: '+str(score))
        sps_label.config(text='score per second: '+str(score_per_second))
        upgrade_sps_button.config(text='upgrade score per second \n cost: '+str(new_cost))
    else:
        return -1

def prestige():
    global score, prestige_points, click_upgrade_index, click_power, sps_upgrade_index, score_per_second
    points=max(int(log(score,5)), 0) if score>=1 else 0

    score=0
    click_power=0.1
    score_per_second=0

    click_upgrade_index=1
    sps_upgrade_index=1

    prestige_points+=points

    score_label.config(text='score: 0')
    click_power_label.config(text='click power: 0.1')
    sps_label.config(text='score per second: 0')
    upgrade_click_button.config(text='upgrade clicking \n cost: 1')
    upgrade_sps_button.config(text='upgrade score per second \n cost: 1')
    prestige_button.config(text='reset all other progress for 0 prestige points')
    prestige_points_label.config(text='prestige points: '+str(prestige_points))

def prestige_upgrades(upgrade):
    global score, prestige_points, cheaper_upgrades_index
    if prestige_points<1:
        messagebox.showinfo(message='you do not have enough prestige points for that.')
        return
    prestige_points-=1
    prestige_points_label.config(text='prestige points: '+str(prestige_points))
    if upgrade==0: #make all upgrades 5% cheaper (mutiplicative)
        cheaper_upgrades_index+=1
    elif upgrade==2: #instant 3 minutes of passive income
        score+=score_per_second*180
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