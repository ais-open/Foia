WinJS.Namespace.define("Utility", {
    s4: function () {
        return Math.floor((1 + Math.random()) * 0x10000)
                   .toString(16)
                   .substring(1);
    },

    guid: function () {
        return this.s4() + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' +
                this.s4() + '-' + this.s4() + this.s4() + this.s4();
    },

    getDeviceId: function () {
        var applicationData = Windows.Storage.ApplicationData.current;
        var localSettings = applicationData.localSettings;

        if (!localSettings.containers.hasKey("Foia.Internal")) {
            localSettings.createContainer("Foia.Internal", Windows.Storage.ApplicationDataCreateDisposition.always);
        }

        var deviceIdContainer = localSettings.containers.lookup("Foia.Internal");

        if (!deviceIdContainer.values["DeviceId"]) {
            deviceIdContainer.values["DeviceId"] = this.guid();
        }

        return deviceIdContainer.values["DeviceId"];
    }
});