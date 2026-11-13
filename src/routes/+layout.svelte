<script>
    import "$lib/styles.css";

    let { children } = $props();
</script>

<svelte:head>
    <link rel="icon" href="https://assets.hackclub.com/icon-rounded.png" />
    <meta name="theme-color" content="#ec3750" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400;700&family=Atkinson+Hyperlegible+Next:wght@400;700;800&family=Darumadrop+One&family=Host+Grotesk:wght@300..800&display=swap" rel="stylesheet">
    <!-- icon_names must stay in alphabetical order -->
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=add_to_queue,admin_panel_settings,arrow_back,arrow_circle_up,calendar_add_on,campaign,cancel,cast,cast_pause,cast_warning,check,check_circle,close,cloud_off,content_copy,description,drive_export,edit,error,event,expand_more,fullscreen,language,link,logout,open_in_new,podcasts,present_to_all,qr_code,schedule,settings_account_box,smart_display,stop_screen_share,sync,tv,undo,video_library&display=block" />
</svelte:head>

{@render children()}
