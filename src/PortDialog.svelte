<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import ColorPicker, { ChromeVariant } from 'svelte-awesome-color-picker';
    const dispatch = createEventDispatcher();
    const close = () => dispatch('close');

    let devices = [];
    let ports = [];

    async function getPaired() {
        ports = await navigator.serial.getPorts();

        devices = ports.map((port) => {
            let info = port.getInfo();
            let name = 'Serial Port';
            if (info.usbProductId && info.usbVendorId) {
                name += (' (usb:0x' + info.usbVendorId.toString(16) + ':0x' + info.usbProductId.toString(16) + ')');
            }
            port.name = 'Serial Port';
            return name;
        });
    }

    function onOkClick() {
        close();
    }

    function onPortSelected(index) {
        dispatch('selected_port', ports[index]);
        close();
    }

    function onDetectNew() {
        navigator.serial.requestPort().then(getPaired);
    }

    onMount(getPaired);
</script>

<style>
    .modal {
        z-index: 400;
    }
</style>

<div class="modal is-active">
    
    <div class="modal-background" />
    <div class="modal-card">
        <header class="modal-card-head">
            <p class="modal-card-title">Paired Ports</p>
            
            <button class="delete" aria-label="close" on:click={onOkClick} />
            
            
        </header>
        <section class="modal-card-body is-paddingless">
            <div class="content has-text-centered" style="margin-bottom: 1em;">
                <strong>Choose from ports below</strong>
            </div>
            {#each devices as dev, i}
                <div
                    class="card"
                    on:click={() => onPortSelected(i)}
                    tabindex={i}>
                    <div class="card-content">
                        <div class="level">
                            <div class="level-left">
                                <button class="button is-fullwidth is-outlined is-info" style="display: flex; align-items: center; gap: 0.5em;">
                                    <span class="icon"><i class="fa fa-plug" /></span>
                                    <span>{dev}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            {/each}
            {#if ports.length === 0}
                <div class="card">
                    <div class="card-content">
                        <div>No paired ports detected</div>
                    </div>
                </div>
            {/if}
        </section>
        <footer class="modal-card-foot">
            <button class="button is-success" on:click={onDetectNew}>Pair new
                port</button>
        </footer>
    </div>
</div>
