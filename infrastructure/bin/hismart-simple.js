#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = require("aws-cdk-lib");
const hismart_simple_stack_1 = require("../lib/hismart-simple-stack");
const app = new cdk.App();
const stackProps = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION || 'us-east-1'
    },
    tags: {
        Project: 'HISmart',
        Environment: 'dev',
        ManagedBy: 'CDK'
    }
};
new hismart_simple_stack_1.HiSmartSimpleStack(app, 'HISmart-Dev', {
    ...stackProps,
    description: 'HISmart - Sistema de búsqueda inteligente de notas clínicas (ambiente dev)'
});
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGlzbWFydC1zaW1wbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJoaXNtYXJ0LXNpbXBsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSx1Q0FBcUM7QUFDckMsbUNBQW1DO0FBQ25DLHNFQUFpRTtBQUVqRSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixNQUFNLFVBQVUsR0FBbUI7SUFDakMsR0FBRyxFQUFFO1FBQ0gsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1FBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7S0FDdEQ7SUFDRCxJQUFJLEVBQUU7UUFDSixPQUFPLEVBQUUsU0FBUztRQUNsQixXQUFXLEVBQUUsS0FBSztRQUNsQixTQUFTLEVBQUUsS0FBSztLQUNqQjtDQUNGLENBQUM7QUFFRixJQUFJLHlDQUFrQixDQUFDLEdBQUcsRUFBRSxhQUFhLEVBQUU7SUFDekMsR0FBRyxVQUFVO0lBQ2IsV0FBVyxFQUFFLDRFQUE0RTtDQUMxRixDQUFDLENBQUM7QUFFSCxHQUFHLENBQUMsS0FBSyxFQUFFLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgSGlTbWFydFNpbXBsZVN0YWNrIH0gZnJvbSAnLi4vbGliL2hpc21hcnQtc2ltcGxlLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuY29uc3Qgc3RhY2tQcm9wczogY2RrLlN0YWNrUHJvcHMgPSB7XG4gIGVudjoge1xuICAgIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gICAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMSdcbiAgfSxcbiAgdGFnczoge1xuICAgIFByb2plY3Q6ICdISVNtYXJ0JyxcbiAgICBFbnZpcm9ubWVudDogJ2RldicsXG4gICAgTWFuYWdlZEJ5OiAnQ0RLJ1xuICB9XG59O1xuXG5uZXcgSGlTbWFydFNpbXBsZVN0YWNrKGFwcCwgJ0hJU21hcnQtRGV2Jywge1xuICAuLi5zdGFja1Byb3BzLFxuICBkZXNjcmlwdGlvbjogJ0hJU21hcnQgLSBTaXN0ZW1hIGRlIGLDunNxdWVkYSBpbnRlbGlnZW50ZSBkZSBub3RhcyBjbMOtbmljYXMgKGFtYmllbnRlIGRldiknXG59KTtcblxuYXBwLnN5bnRoKCk7Il19