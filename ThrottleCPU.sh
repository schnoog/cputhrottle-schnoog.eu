#!/usr/bin/bash



#/.config/cinnamon/spices/cputhrottle@schnoog.eu/cputhrottle@schnoog.eu.json

IFS="
"

BSP=$(dirname "$(realpath $0)")

APPLETID=$(basename "$BSP")
export APPLETSETTINGSFILE="$HOME""/.config/cinnamon/spices/""$APPLETID""/""$APPLETID"".json"



#echo "$APPLETID -- $APPLETSETTINGSFILE"




FST=8   #Default number of steps -1
DST=0   #Default step: 0 -> Unthrottled
if [ -f "$APPLETSETTINGSFILE" ]; then
    FST=$(grep -A4 'cpu-steps'  "$APPLETSETTINGSFILE" | grep '"value":' | cut -d '"' -f 4 )
    DST=$(grep -A4 'default-step'  "$APPLETSETTINGSFILE" | grep '"value":' | cut -d '"' -f 4 )
fi


#echo "FST $FST DEF $DST"


############################################################################
#
# Start of settings
#
############################################################################
export FREQSTEPSCOUNT=$FST
############################################################################
#
# End of settings
#
############################################################################

############################################################################
#
# Start of functions
#
############################################################################
GetFreqSteps(){
    HWD=$(cpufreq-info -l)
    MIN=$(echo "$HWD" | cut -d " " -f 1)
    MAX=$(echo "$HWD" | cut -d " " -f 2)
    STEPWIDTH=$(echo "( $MAX - $MIN )/ $FREQSTEPSCOUNT" | bc)
    WORKVAL=$MAX
    while [ $WORKVAL -ge $MIN ]
    do
        TVAL=$(echo "$WORKVAL" | awk '{print int(($1 + 50000) / 100000) * 100000}')
        if [ $TVAL -gt $MAX ]
        then
            TVAL=$MAX
        fi
        echo $TVAL
        let WORKVAL=$WORKVAL-$STEPWIDTH
    done
}


check_input() {
    local num="$1"
    MIN=0
    MAX=$FREQSTEPSCOUNT
    # Check if the input is a valid integer
    if [[ "$num" =~ ^-?[0-9]+$ ]]; then
        # Check if the number is within the specified range
        if (( num >= MIN && num <= MAX )); then
            return 0  # Valid input
        else
            return 1  # Input out of range
        fi
    else
        return 2  # Not a valid integer
    fi
}




CPUThrottleCores(){
    NEW=$1
    CPU=0
    SD=""
    if [ "$user" != "root" ]
    then
        SD="/usr/bin/sudo"
    fi
    while [ $CPU -lt $CORS ]
    do
        #echo "Throttle core $CPU to $NEW"
        #echo "$SD cpufreq-set -u $NEW -c $CPU"
        $SD cpufreq-set -u $NEW -c $CPU
        let CPU=$CPU+1
    done
}


CPUIsThottled(){
    export CPUCURR=$(cpufreq-info -p | cut -d ' ' -f 2)
    export CPUMAX=$(cpufreq-info -l | cut -d ' ' -f 2)
    if [ "$CPUCURR" -lt "$CPUMAX" ]
    then
        return 0
    else
        return 1
    fi
}

CPUSetThottle(){
    FREQ=$1
    echo "Try to set frequency to $1"
    for STEP in $FSTEPS
    do
        #echo "$STEP"
        echo "$STEP" | grep "$FREQ" > /dev/null && echo "Set Freuency to $STEP" && CPUThrottleCores $STEP
    done
}


ShowSteps(){
    if [ "$1" != "b" ]
    then
     echo "Possible frequencies:"
     echo "   (STEP) FREQUENCY"
    fi

    CNT=0
    for STEP in $FSTEPS
    do
            if [ "$1" != "b" ]
            then
                echo "     ($CNT)   $STEP"

            else
                echo $STEP

            fi

        let CNT=$CNT+1         
    done
}

ThrottleInfo(){
    echo "Throttle-Script"
    echo "Gets or sets the frequencies of all CPU cores"
#    echo "Level:"
    echo "Available levels are 0 (unthrottled) to $FREQSTEPSCOUNT (fully throttled)" 
 
    echo "Usage $0 <level>/b/g/s <freq>/l [b]"
    echo " <without> - show current state and this info"
    echo "$0 [0-$FREQSTEPSCOUNT]      - Sets the CPU Limit to the given level"
    echo "$0 b          - Current stated (throttled (0) / unthrottled(1) ) as return value"
    echo "$0 l          - list of possible frequencies"
    echo "$0 l b        - Batch mode, only values"
    echo "$0 s <freq>    - sets the frequency to <freq> if a valid one is supplied"
    echo "$0 g          - gets the current level"

}

############################################################################
#
# End of functions
#
############################################################################
export FSTEPS=$(GetFreqSteps)
CORENUM=$(cpufreq-info | grep analysiere | tail -n 1 | cut -d " " -f 3 | cut -d ':' -f1)
let CORENUM=$CORENUM+1
export CORS=$CORENUM
CMD=$1


if [ "$CMD" == "" ]
then
    if CPUIsThottled
    then
        echo "CPU is throttled ($CPUCURR GHz)"
    else
        echo "CPU isn't throttled"
    fi
    ThrottleInfo
    ShowSteps
    exit 0
fi

if [ "$CMD" == "l" ]
then
    if [ "$2" == "b" ]
    then
        ShowSteps "b"
    else
        ShowSteps
    fi
    exit 0
fi

if [ "$CMD" == "s" ]
then
    NF=$2
    NFS=$(echo "$FSTEPS" | grep $NF"$")
    if [ "$NFS" == "" ]
    then
        echo "Requested frequence is not an option: $NFS"
        ShowSteps
    else
        CPUSetThottle $NFS
    fi
    exit 0
fi

if [ "$CMD" == "b" ]
then
    if CPUIsThottled
    then
        exit 0
    else
        exit 1
    fi
fi


if [ "$CMD" == "g" ]
then
    CURR=$(cpufreq-info -p | cut -d " " -f 2)
    SCNT=0
    for STEP in $FSTEPS
    do
        #echo "Check $STEP against $CURR" 
        if [ "$STEP" == "$CURR" ]
        then
            echo $SCNT
        fi
        let SCNT=$SCNT+1

    done
fi




if check_input "$CMD"
then
    SCNT=0
    for STEP in $FSTEPS
    do
        if [ "$SCNT" == "$CMD" ]
        then
            CPUSetThottle $STEP
        fi
        let SCNT=$SCNT+1

    done
fi

