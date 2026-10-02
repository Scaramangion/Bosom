        // ================= HERO SPRITE: HD pixel art drawn by the WebGL layer, with switchable outfits =================
        // The game grid still owns position and collision. The pixel-art hero is drawn as a smooth-scaled cutout on top of the scene (lit by the same lamps).
        // Frames are [x, y, w, h, feetX, feetY] in the atlas; every frame is 88 px tall and stands on its feet point.
        const HERO_FRAMES = {"rideN0":[0,1966,40,85,20.0,85.0],"rideN1":[42,1965,40,86,20.0,86.0],"rideN2":[84,1964,40,87,20.0,87.0],"rideN3":[126,1963,41,88,20.5,88.0],"rideN4":[169,1966,41,85,20.5,85.0],"rideN5":[212,1965,41,86,20.5,86.0],"rideN6":[255,1964,40,87,20.0,87.0],"rideN7":[297,1963,40,88,20.0,88.0],"rideS0":[339,1954,34,97,17.0,97.0],"rideS1":[375,1953,34,98,17.0,98.0],"rideS2":[411,1952,34,99,17.0,99.0],"rideS3":[447,1951,34,100,17.0,100.0],"rideS4":[483,1954,34,97,17.0,97.0],"rideS5":[519,1953,34,98,17.0,98.0],"rideS6":[555,1952,34,99,17.0,99.0],"rideS7":[591,1951,34,100,17.0,100.0],"kt_swing":[0,1660,119,174,72.0,174.0],"kt_punch":[121,1660,91,119,43.0,119.0],"kt2_wl0":[214,1660,66,115,34.0,115.0],"kt2_wl2":[282,1660,65,115,31.0,115.0],"kt_sw_idle_r":[349,1660,96,115,32.0,115.0],"kt2_wl1":[447,1660,65,114,33.0,114.0],"kt2_wl3":[514,1660,65,114,34.0,114.0],"kt_swr1":[581,1660,97,114,31.0,114.0],"kt_swr2":[680,1660,97,114,31.0,114.0],"kt2_wd1":[779,1660,75,111,37.0,111.0],"kt2_wd2":[856,1660,75,111,37.0,111.0],"kt_swr0":[0,1836,97,111,30.0,111.0],"kt_sw_idle_u":[99,1836,102,111,66.0,111.0],"kt2_wd0":[203,1836,74,110,36.0,110.0],"kt_down":[0,1362,72,123,35.5,123.0],"kt_wd0":[74,1362,64,110,31.5,110.0],"kt_wd1":[140,1362,64,110,31.5,110.0],"kt_wu0":[206,1362,67,110,33.0,110.0],"kt_down_right":[275,1362,66,109,32.5,109.0],"kt_wd3":[343,1362,67,109,33.0,109.0],"kt_ws0":[412,1362,68,109,33.5,109.0],"kt_ws1":[482,1362,75,109,37.0,109.0],"kt_ws2":[559,1362,67,109,33.0,109.0],"kt_right":[628,1362,54,108,26.5,108.0],"kt_up_right":[684,1362,65,108,32.0,108.0],"kt_wd2":[751,1362,63,108,31.0,108.0],"kt_ws3":[816,1362,79,108,39.0,108.0],"kt_wu1":[897,1362,61,108,30.0,108.0],"kt_wu2":[0,1487,65,108,32.0,108.0],"kt_wu3":[67,1487,66,107,32.5,107.0],"kt_up":[135,1487,63,104,31.0,104.0],"ch_wdr0":[200,1487,39,71,19.0,71.0],"ch_wdl0":[241,1487,41,71,20.0,71.0],"ch_wdr1":[284,1487,41,71,20.0,71.0],"ch_wdl1":[327,1487,43,71,21.0,71.0],"ch_wdr2":[372,1487,44,71,21.5,71.0],"ch_wdr3":[418,1487,36,71,17.5,71.0],"ch_wdl3":[456,1487,40,71,19.5,71.0],"ch_wdl2":[498,1487,43,70,21.0,70.0],"ch_run0":[543,1487,42,67,20.5,67.0],"ch_run6":[587,1487,43,67,21.0,67.0],"ch_run1":[632,1487,40,66,19.5,66.0],"ch_run3":[674,1487,41,66,20.0,66.0],"ch_run5":[717,1487,40,66,19.5,66.0],"ch_run7":[759,1487,39,66,19.0,66.0],"ch_run9":[800,1487,41,66,20.0,66.0],"ch_run11":[843,1487,41,66,20.0,66.0],"ch_run2":[886,1487,43,63,21.0,63.0],"ch_run8":[931,1487,43,63,21.0,63.0],"ch_run4":[976,1487,44,59,21.5,59.0],"ch_run10":[0,1597,47,59,23.0,59.0],"rj_walk1_down":[0,1102,89,130,44.0,130.0],"rj_walk1_up":[91,1102,87,130,43.0,130.0],"rj_walk2_down":[180,1102,71,130,35.0,130.0],"rj_walk2_up":[253,1102,84,130,41.5,130.0],"rj_walk3_down":[339,1102,68,130,33.5,130.0],"rj_walk3_up":[409,1102,83,130,41.0,130.0],"rj_walk1_right":[494,1102,88,128,43.5,128.0],"rj_walk2_right":[584,1102,63,128,31.0,128.0],"rj_walk3_right":[649,1102,64,128,31.5,128.0],"rj_walk1_down_right":[715,1102,85,124,42.0,124.0],"rj_walk1_up_right":[802,1102,86,124,42.5,124.0],"rj_walk2_down_right":[890,1102,65,124,32.0,124.0],"rj_walk2_up_right":[957,1102,58,124,28.5,124.0],"rj_walk3_down_right":[0,1234,62,124,30.5,124.0],"rj_walk3_up_right":[64,1234,58,124,28.5,124.0],"rj_down":[0,970,65,130,32.0,130.0],"rj_up":[67,970,69,130,34.0,130.0],"rj_right":[138,970,41,128,20.0,128.0],"rj_left":[181,970,41,128,20.0,128.0],"rj_down_right":[224,970,60,124,29.5,124.0],"rj_up_right":[286,970,60,124,29.5,124.0],"rj_up_left":[348,970,60,124,29.5,124.0],"rj_down_left":[410,970,60,124,29.5,124.0],"ride_l4":[0,0,93,107,41.9,107.0],"ride_l5":[94,0,81,107,36.5,107.0],"ride_l2":[176,0,93,106,41.9,106.0],"ride_l3":[270,0,93,106,41.9,106.0],"child_atk2":[364,0,68,104,34.0,104.0],"mount2":[433,0,61,102,30.5,102.0],"mount5":[495,0,76,102,38.0,102.0],"mount1":[572,0,78,101,39.0,101.0],"mount4":[651,0,76,101,38.0,101.0],"mount3":[728,0,53,99,26.5,99.0],"ride_l0":[782,0,81,99,36.5,99.0],"ride_l6":[864,0,89,99,40.1,99.0],"child_atk1":[0,108,82,97,41.0,97.0],"tool_axe":[83,108,48,96,24.0,96.0],"ride_r4":[132,108,93,96,51.2,96.0],"ride_r5":[226,108,100,96,55.0,96.0],"ride_r3":[327,108,96,94,52.8,94.0],"ride_l1":[424,108,98,94,44.1,94.0],"kael_idle":[523,108,63,93,31.5,93.0],"ride_r0":[587,108,97,93,53.4,93.0],"ride_r6":[685,108,101,93,55.6,93.0],"ride_r7":[787,108,96,93,52.8,93.0],"child_axe_down":[884,108,44,89,22.0,89.0],"kael_rr0":[929,108,64,89,32.0,89.0],"ch_punch0":[0,206,56,88,28.0,88.0],"ch_punch1":[57,206,57,88,28.5,88.0],"child_axe_right":[115,206,48,88,24.0,88.0],"child_axe_up":[164,206,64,88,32.0,88.0],"kael_rl0":[229,206,64,88,32.0,88.0],"nc_idle_u":[294,206,61,88,30.5,88.0],"nc_run_r1":[356,206,61,88,30.5,88.0],"nc_run_u5":[418,206,61,88,30.5,88.0],"nc_run_u0":[480,206,61,88,30.5,88.0],"nc_run_d5":[542,206,61,88,30.5,88.0],"nc_walk_d5":[604,206,61,88,30.5,88.0],"nc_run_d3":[666,206,61,88,30.5,88.0],"nc_run_d4":[728,206,61,88,30.5,88.0],"nc_run_r5":[790,206,61,88,30.5,88.0],"nc_run_d0":[852,206,61,88,30.5,88.0],"nc_run_u1":[914,206,61,88,30.5,88.0],"nc_walk_d0":[0,295,61,88,30.5,88.0],"nc_walk_d3":[62,295,61,88,30.5,88.0],"nc_walk_u4":[124,295,61,88,30.5,88.0],"nc_walk_u2":[186,295,61,88,30.5,88.0],"nc_walk_r0":[248,295,61,88,30.5,88.0],"nc_walk_u1":[310,295,61,88,30.5,88.0],"nc_run_r2":[372,295,61,88,30.5,88.0],"nc_run_r3":[434,295,61,88,30.5,88.0],"nc_walk_u3":[496,295,61,88,30.5,88.0],"nc_walk_r2":[558,295,61,88,30.5,88.0],"nc_walk_r1":[620,295,61,88,30.5,88.0],"nc_run_u4":[682,295,61,88,30.5,88.0],"nc_walk_r3":[744,295,61,88,30.5,88.0],"nc_run_u3":[806,295,61,88,30.5,88.0],"nc_walk_d4":[868,295,61,88,30.5,88.0],"nc_walk_d1":[930,295,61,88,30.5,88.0],"nc_run_r0":[0,384,61,88,30.5,88.0],"nc_run_d1":[62,384,61,88,30.5,88.0],"nc_run_d2":[124,384,61,88,30.5,88.0],"nc_walk_r4":[186,384,61,88,30.5,88.0],"nc_run_r4":[248,384,61,88,30.5,88.0],"nc_walk_u0":[310,384,61,88,30.5,88.0],"nc_idle_r":[372,384,61,88,30.5,88.0],"nc_idle_d":[434,384,61,88,30.5,88.0],"nc_walk_r5":[496,384,61,88,30.5,88.0],"nc_run_u2":[558,384,61,88,30.5,88.0],"nc_walk_u5":[620,384,61,88,30.5,88.0],"nc_walk_d2":[682,384,61,88,30.5,88.0],"kael_rr1":[744,384,52,87,26.0,87.0],"ride_r2":[797,384,103,87,56.7,87.0],"basic_down":[901,384,41,86,20.5,86.0],"basic_right":[943,384,31,86,15.5,86.0],"kael_rr2":[0,473,59,86,29.5,86.0],"kael_sl0":[60,473,66,86,33.0,86.0],"kael_sl2":[127,473,64,86,32.0,86.0],"kael_sl3":[192,473,64,86,32.0,86.0],"kael_sr0":[257,473,64,86,32.0,86.0],"kael_sr1":[322,473,64,86,32.0,86.0],"kael_sr3":[387,473,65,86,32.5,86.0],"starter_down":[453,473,38,86,19.0,86.0],"ride_r1":[492,473,101,86,55.6,86.0],"kael_sl1":[594,473,62,85,31.0,85.0],"kael_sr2":[657,473,62,85,31.0,85.0],"basic_wu1":[720,473,42,84,21.0,84.0],"basic_up":[763,473,36,83,18.0,83.0],"basic_wd0":[800,473,33,83,16.5,83.0],"basic_wd1":[834,473,39,83,19.5,83.0],"basic_wr1":[874,473,59,83,29.5,83.0],"basic_wu0":[934,473,36,83,18.0,83.0],"basic_wr0":[971,473,46,82,23.0,82.0],"basic_wr2":[0,560,37,82,18.5,82.0],"basic_wr3":[38,560,60,82,30.0,82.0],"child_atk0":[99,560,79,80,39.5,80.0],"kael_rr4":[179,560,76,80,38.0,80.0],"kael_rl3":[256,560,81,78,40.5,78.0],"kael_rl2":[338,560,79,77,39.5,77.0],"kael_rl4":[418,560,77,76,38.5,76.0],"horse_side_b":[496,560,109,73,54.5,73.0],"pouch_open2":[606,560,35,72,17.5,72.0],"kael_rl1":[642,560,70,71,35.0,71.0],"pouch_open1":[713,560,35,71,17.5,71.0],"roll_down_0":[749,560,42,70,21.2,69.8],"roll_down_8":[792,560,42,70,20.3,69.8],"pouch_open0":[835,560,34,70,17.0,70.0],"pouch_open3":[870,560,34,70,17.0,70.0],"pouch_rum0":[905,560,34,70,17.0,70.0],"pouch_ret0":[940,560,33,70,16.5,70.0],"pouch_ret1":[974,560,31,70,15.5,70.0],"pouch_ret3":[0,643,41,70,20.5,70.0],"horse_side_a":[42,643,108,70,54.0,70.0],"roll_up_2":[151,643,35,69,17.0,68.7],"roll_up_8":[187,643,35,69,17.0,68.7],"roll_up_right_0":[223,643,45,69,21.6,68.8],"roll_up_right_8":[269,643,45,69,23.2,68.8],"roll_right_0":[315,643,34,69,18.7,68.8],"roll_right_2":[350,643,35,69,18.7,68.8],"roll_right_6":[386,643,34,69,15.3,68.8],"roll_right_8":[421,643,34,69,15.3,68.8],"roll_down_right_0":[456,643,42,69,20.9,68.9],"roll_down_right_1":[499,643,49,69,25.3,68.9],"roll_down_right_7":[549,643,40,69,14.8,68.9],"roll_down_right_8":[590,643,39,69,18.3,68.9],"roll_down_1":[630,643,42,69,22.1,68.9],"roll_down_left_0":[673,643,52,69,27.7,68.9],"roll_down_left_8":[726,643,50,69,24.2,68.9],"pouch_rum1":[777,643,33,69,16.5,69.0],"pouch_ret2":[811,643,41,69,20.5,69.0],"horse_rear":[853,643,40,69,20.0,69.0],"axe_back0":[894,643,43,69,26.0,69.0],"axe_back2":[938,643,44,69,16.0,69.0],"axe_back3":[0,714,43,69,15.0,69.0],"kael_rr3":[44,714,67,68,33.5,68.0],"roll_up_right_2":[112,714,48,68,23.2,68.0],"roll_up_right_6":[161,714,47,68,24.9,68.0],"roll_right_7":[209,714,34,68,16.2,68.0],"roll_down_7":[244,714,42,68,20.3,68.0],"pouch_rum2":[287,714,32,68,16.0,68.0],"pouch_rum3":[320,714,33,68,16.5,68.0],"horse_q_br":[354,714,71,68,35.5,68.0],"horse_q_bl":[426,714,71,68,35.5,68.0],"axe_idle_d":[498,714,39,68,17.0,68.0],"axe_front0":[538,714,42,68,21.0,68.0],"axe_sw_n0":[581,714,53,68,33.0,68.0],"axe_front2":[635,714,41,68,19.0,68.0],"axe_sw_n3":[677,714,50,68,14.0,68.0],"roll_up_1":[728,714,34,67,17.0,67.3],"roll_up_6":[763,714,35,67,17.7,67.3],"roll_up_7":[799,714,35,67,17.0,67.3],"roll_up_right_1":[835,714,50,67,24.9,67.2],"roll_up_right_7":[886,714,49,67,24.9,67.2],"roll_right_1":[936,714,34,67,17.8,67.1],"roll_down_right_2":[971,714,52,67,26.2,67.1],"roll_down_left_7":[0,784,48,67,17.9,67.1],"horse_front":[49,784,30,67,15.0,67.0],"axe_sw_s0":[80,784,48,67,22.0,67.0],"axe_sw_e0":[129,784,47,67,29.0,67.0],"axe_sw_n1":[177,784,52,67,32.0,67.0],"axe_sw_e3":[230,784,39,67,16.0,67.0],"horse_q_fl":[270,784,69,66,34.5,66.0],"axe_front1":[340,784,42,66,21.0,66.0],"axe_back1":[383,784,44,66,25.0,66.0],"axe_sw_e1":[428,784,52,66,31.0,66.0],"axe_sw_e2":[481,784,55,66,18.0,66.0],"axe_front3":[537,784,42,66,21.0,66.0],"roll_down_right_5":[580,784,55,65,24.4,64.5],"roll_down_left_1":[636,784,61,65,32.2,65.3],"axe_sw_s1":[698,784,54,65,33.0,65.0],"roll_down_left_6":[753,784,61,64,27.7,63.5],"axe_sw_n2":[815,784,41,64,24.0,64.0],"axe_sw_s3":[857,784,39,64,18.0,64.0],"kael_rr5":[897,784,70,63,35.0,63.0],"roll_down_left_2":[0,852,63,63,30.4,62.6],"roll_down_left_5":[64,852,63,63,31.3,62.6],"axe_sw_s2":[128,852,45,63,17.0,63.0],"roll_down_right_6":[174,852,58,62,27.0,61.9],"horse_q_fr":[233,852,70,62,35.0,62.0],"axe_side_l0":[304,852,44,60,23.0,60.0],"axe_side_l1":[349,852,42,60,22.0,60.0],"axe_side_r0":[392,852,42,60,19.0,60.0],"axe_side_r1":[435,852,44,60,19.0,60.0],"kael_rl5":[480,852,80,59,40.0,59.0],"jump_0":[561,852,40,59,19.9,58.5],"jump_3":[602,852,40,57,17.5,56.1],"jump_4":[643,852,35,57,17.5,56.9],"roll_down_2":[679,852,53,56,27.4,55.6],"roll_down_4":[733,852,53,56,26.5,55.6],"roll_down_5":[787,852,53,55,25.6,54.8],"jump_1":[841,852,44,55,16.4,55.0],"jump_2":[886,852,39,55,19.4,55.0],"roll_down_6":[926,852,52,54,24.7,53.9],"roll_down_left_4":[0,916,55,53,27.7,52.8],"roll_down_left_3":[56,916,54,52,27.7,51.9],"roll_right_3":[111,916,51,51,25.5,51.0],"roll_right_4":[163,916,51,51,25.5,51.0],"roll_right_5":[215,916,51,51,24.6,51.0],"roll_down_right_3":[267,916,52,51,27.0,50.6],"roll_down_right_4":[320,916,54,51,27.0,51.4],"roll_down_3":[375,916,54,51,27.4,51.2],"roll_up_5":[430,916,41,49,20.4,49.0],"roll_up_right_3":[472,916,50,49,24.9,48.9],"roll_up_right_4":[523,916,50,49,24.9,48.9],"roll_up_right_5":[574,916,50,49,24.0,48.9],"roll_up_3":[625,916,41,46,20.4,46.2],"roll_up_4":[667,916,41,41,20.4,40.8],"rjn_d0":[0,2053,55,120,27.2,120.0],"rjn_d1":[57,2053,51,120,24.3,120.0],"rjn_d2":[110,2053,50,119,24.2,119.0],"rjn_d3":[162,2053,55,120,25.7,120.0],"rjs_u0":[219,2053,63,120,32.3,120.0],"rjs_u1":[284,2053,63,119,32.6,119.0],"rjs_u2":[349,2053,63,120,32.4,120.0],"rjs_u3":[414,2053,63,121,32.1,121.0],"rjs_u4":[479,2053,63,119,32.2,119.0],"rjs_u5":[544,2053,63,120,32.2,120.0],"rjn_u0":[609,2053,63,120,31.9,120.0],"rjn_u1":[674,2053,63,119,32.2,119.0],"rjn_u2":[739,2053,63,120,31.9,120.0],"rjn_u3":[804,2053,63,121,31.7,121.0],"rjn_u4":[869,2053,63,119,31.8,119.0],"rjn_u5":[934,2053,63,120,31.8,120.0],"rjs_r0":[0,2176,58,120,23.1,120.0],"rjs_r1":[60,2176,52,119,22.5,119.0],"rjs_r2":[114,2176,47,119,23.3,119.0],"rjs_r3":[163,2176,41,120,19.9,120.0],"rjs_r4":[206,2176,47,120,21.7,120.0],"rjs_r5":[255,2176,57,120,26.2,120.0],"rjs_l0":[314,2176,56,120,29.1,120.0],"rjs_l1":[372,2176,51,119,28.3,119.0],"rjs_l2":[425,2176,48,120,23.4,120.0],"rjs_l3":[475,2176,48,120,23.6,120.0],"rjs_l4":[525,2176,51,120,28.4,120.0],"rjs_l5":[578,2176,57,120,33.1,120.0],"rjd_r0":[637,2176,58,120,25.2,120.0],"rjd_r1":[697,2176,52,119,24.5,119.0],"rjd_r2":[751,2176,47,119,25.3,119.0],"rjd_r3":[800,2176,41,120,22.0,120.0],"rjd_r4":[843,2176,47,120,23.7,120.0],"rjd_r5":[892,2176,57,120,28.2,120.0],"rjd_l0":[951,2176,56,120,27.1,120.0],"rjd_l1":[0,2298,51,119,26.3,119.0],"rjd_l2":[53,2298,48,120,21.4,120.0],"rjd_l3":[103,2298,48,120,21.5,120.0],"rjd_l4":[153,2298,51,120,26.4,120.0],"rjd_l5":[206,2298,57,120,31.0,120.0],"rj_sword":[265,2298,23,59,11.5,59.0],"rja_d0":[0,2421,72,117,41.5,117.0],"rja_d1":[74,2421,68,115,29.0,115.0],"rja_d2":[144,2421,69,130,36.4,130.0],"rja_d3":[215,2421,69,130,36.7,130.0],"rja_d4":[286,2421,69,130,31.3,130.0],"rja_d5":[357,2421,72,128,37.3,128.0],"rja_d6":[431,2421,88,129,41.5,129.0],"rja_d7":[521,2421,117,130,37.0,130.0],"rja_d8":[640,2421,102,110,70.1,110.0],"rja_r0":[744,2421,67,119,32.8,119.0],"rja_r1":[813,2421,59,119,32.8,119.0],"rja_r2":[874,2421,64,121,32.5,121.0],"rja_r3":[940,2421,69,118,40.8,118.0],"rja_r4":[0,2553,59,119,28.0,119.0],"rja_r5":[61,2553,127,125,33.3,125.0],"rja_r6":[190,2553,93,118,62.4,118.0],"rja_r7":[285,2553,59,119,32.8,119.0],"rja_r8":[346,2553,65,119,39.2,119.0]};
        const HERO_ATLAS = [1024, 2679];
        const HERO_TARGET_H = 23;        // hero height in game px (about 1.45 tiles)
        const DEFAULT_OUTFIT = 'koto'; // the protagonist
        const ACTION_FRAMES = 20; // one axe swing (or punch), in frames
        const HERO_WALK_CYCLE_MS = 840, HERO_RUN_CYCLE_MS = 520; // one full stride (two steps), whatever the cycle's frame count
        // Outfit tables can name any of the 8 facings: down, down_right, right, up_right, up, up_left, left, down_left.
        // Missing facings borrow their mirror image, then the nearest view (see heroLookup). Optional per outfit:
        //   roll: { dir: [frames...] }  the tumble (otherwise a stand-in built from the run frames)
        // Optional per frame: HERO_HANDS[frame] = [x, y] in that frame's pixels, where the held item's grip sits.
        const HERO_HANDS = {};
        // idle[dir] and walk[dir] name atlas frames. A trailing ~ mirrors a frame. Left reuses the right frames mirrored. Anything missing falls back to the front view with a bob.
        const HERO_OUTFITS = {
            child: { label: 'CHILD', idle: { right: 'nc_idle_r', down: 'nc_idle_d', up: 'nc_idle_u', up_right: 'roll_up_right_8', down_right: 'roll_down_right_8', down_left: 'roll_down_left_8' },
                // the 8-way roll sheet: left and up_left are its right-hand rows mirrored (the drawn ones face the wrong way); up skips a front-facing frame 0
                roll: { down: ['roll_down_0','roll_down_1','roll_down_2','roll_down_3','roll_down_4','roll_down_5','roll_down_6','roll_down_7','roll_down_8'], down_right: ['roll_down_right_0','roll_down_right_1','roll_down_right_2','roll_down_right_3','roll_down_right_4','roll_down_right_5','roll_down_right_6','roll_down_right_7','roll_down_right_8'], right: ['roll_right_0','roll_right_1','roll_right_2','roll_right_3','roll_right_4','roll_right_5','roll_right_6','roll_right_7','roll_right_8'], up_right: ['roll_up_right_0','roll_up_right_1','roll_up_right_2','roll_up_right_3','roll_up_right_4','roll_up_right_5','roll_up_right_6','roll_up_right_7','roll_up_right_8'], up: ['roll_up_1','roll_up_2','roll_up_3','roll_up_4','roll_up_5','roll_up_6','roll_up_7','roll_up_8'], down_left: ['roll_down_left_0','roll_down_left_1','roll_down_left_2','roll_down_left_3','roll_down_left_4','roll_down_left_5','roll_down_left_6','roll_down_left_7','roll_down_left_8'] },
                jump: { right: ['jump_0', 'jump_1', 'jump_2', 'jump_3', 'jump_4'], down: ['jump_0', 'jump_1', 'jump_2', 'jump_3', 'jump_4'] }, // crouch, leap, tuck, land, recover // the main model: side, front and back views (left is the mirror)
                walk: { down_right: ['ch_wdr0','ch_wdr1','ch_wdr2','ch_wdr3'], down_left: ['ch_wdl0','ch_wdl1','ch_wdl2','ch_wdl3'], right: ['nc_walk_r0','nc_walk_r1','nc_walk_r2','nc_walk_r3','nc_walk_r4','nc_walk_r5'], down: ['nc_walk_d0','nc_walk_d1','nc_walk_d2','nc_walk_d3','nc_walk_d4','nc_walk_d5'], up: ['nc_walk_u0','nc_walk_u1','nc_walk_u2','nc_walk_u3','nc_walk_u4','nc_walk_u5'] },
                run: { right: ['ch_run0','ch_run1','ch_run2','ch_run3','ch_run4','ch_run5','ch_run6','ch_run7','ch_run8','ch_run9','ch_run10','ch_run11'], down: ['nc_run_d0','nc_run_d1','nc_run_d2','nc_run_d3','nc_run_d4','nc_run_d5'], up: ['nc_run_u0','nc_run_u1','nc_run_u2','nc_run_u3','nc_run_u4','nc_run_u5'] },
                attack: { down: ['axe_sw_s0', 'axe_sw_s1', 'axe_sw_s2', 'axe_sw_s3'], right: ['axe_sw_e0', 'axe_sw_e1', 'axe_sw_e2', 'axe_sw_e3'], up: ['axe_sw_n0', 'axe_sw_n1', 'axe_sw_n2', 'axe_sw_n3'] }, // axe swing: start, mid, impact, recovery (left mirrors right)
                axeRun: { down: ['axe_front0', 'axe_front1', 'axe_front2', 'axe_front3'], right: ['axe_side_r0', 'axe_side_l0~', 'axe_side_r1', 'axe_side_l1~'], up: ['axe_back3', 'axe_back2'] }, // moving with the axe in hand
                axeIdle: { up: 'axe_sw_n3', down: 'axe_idle_d', right: 'axe_sw_e3' }, // standing still with the axe equipped: the axe is part of the pose (left mirrors right; the sheet's W pose faces the wrong way)
                punch: ['ch_punch0', 'ch_punch1'] }, // bare-fist jab, shown while unarmed and the action button is pressed (left/right only)
            starter: { label: 'STARTER', idle: { down: 'starter_down' }, walk: {} }, // only a front view exists so far
            basic: { label: 'BASIC STANDARD', idle: { down: 'basic_down', up: 'basic_up', right: 'basic_right' },
                walk: { right: ['basic_wr0', 'basic_wr1', 'basic_wr2', 'basic_wr3'], down: ['basic_wd0', 'basic_wd1', 'basic_wd0', 'basic_wd1~'], up: ['basic_wu0', 'basic_wu1', 'basic_wu0', 'basic_wu1~'] } },
            kael: { label: 'KAEL', idle: { down: 'kael_idle', right: 'kael_sr0' },
                walk: { right: ['kael_sr0', 'kael_sr1', 'kael_sr2', 'kael_sr3'], down: ['kael_sl0', 'kael_sl1', 'kael_sl2', 'kael_sl3'] },
                run: { right: ['kael_rr0', 'kael_rr1', 'kael_rr2', 'kael_rr3', 'kael_rr4', 'kael_rr5'], left: ['kael_rl0', 'kael_rl1', 'kael_rl2', 'kael_rl3', 'kael_rl4', 'kael_rl5'] },},
            koto: { label: 'KOTO', // red cape + dreadlocks: front, front-right, right, back-right and back are drawn; the left-hand views mirror them (the sheet's 270/315 poses face the wrong way). No run sheet yet, so running reuses the walk
                idle: { down: 'kt_down', down_right: 'kt_down_right', right: 'kt_right', up_right: 'kt_up_right', up: 'kt_up' },
                hands: { right: [0.06, -0.27], down: [-0.21, -0.28], up: [0.2, -0.3] }, // his fists sit low and wide (big hair, short arms)
                walk: { down: ['kt2_wd0', 'kt2_wd1', 'kt2_wd2', 'kt2_wd1'], left: ['kt2_wl0', 'kt2_wl1', 'kt2_wl2', 'kt2_wl3'], up: ['kt_wu0', 'kt_wu1', 'kt_wu2', 'kt_wu3'] }, // overhead sheet: the side walk faces left, so right mirrors it
                swordIdle: { right: 'kt_sw_idle_r', up: 'kt_sw_idle_u' }, swordRun: { right: ['kt_swr0', 'kt_swr1', 'kt_swr2', 'kt_swr1'] }, // sword in hand: baked into the pose (left mirrors right)
                swordAttack: { down: ['kt_swing'], right: ['kt_swing'], up: ['kt_swing'] }, // overhead swing
                punch: ['kt_punch'] },
            rahjai: { label: 'RAHJAI', // spiky blue hair, red cape. Sheathed: the sword rides on his back. Drawn: it moves to his right hand (rj_sword) and the frames without it take over
                idle: { down: 'rjn_d0', right: 'rjs_r0', left: 'rjs_l0', up: 'rjs_u0' },
                walk: { down: ['rjn_d0', 'rjn_d1', 'rjn_d2', 'rjn_d3'], right: ['rjs_r0', 'rjs_r1', 'rjs_r2', 'rjs_r3', 'rjs_r4', 'rjs_r5'], left: ['rjs_l0', 'rjs_l1', 'rjs_l2', 'rjs_l3', 'rjs_l4', 'rjs_l5'], up: ['rjs_u0', 'rjs_u1', 'rjs_u2', 'rjs_u3', 'rjs_u4', 'rjs_u5'] }, // left is drawn facing left (no mirroring)
                drawn: { idle: { down: 'rjn_d0', right: 'rjd_r0', left: 'rjd_l0', up: 'rjn_u0' }, // sword out: the same walks with the back sword painted out (left drawn facing left, never mirrored)
                    walk: { down: ['rjn_d0', 'rjn_d1', 'rjn_d2', 'rjn_d3'], right: ['rjd_r0', 'rjd_r1', 'rjd_r2', 'rjd_r3', 'rjd_r4', 'rjd_r5'], left: ['rjd_l0', 'rjd_l1', 'rjd_l2', 'rjd_l3', 'rjd_l4', 'rjd_l5'], up: ['rjn_u0', 'rjn_u1', 'rjn_u2', 'rjn_u3', 'rjn_u4', 'rjn_u5'] } },
                hands: { right: [0.03, -0.38], down: [-0.17, -0.36], up: [0.17, -0.37] },
                // the sword attack, drawn (MML style): wind-up, the cut with its blue arc, the impact flash, recover. Facing away he has no drawn attack, so the rigged swing plays
                swordAttack: { down: ['rja_d0', 'rja_d1', 'rja_d2', 'rja_d3', 'rja_d4', 'rja_d5', 'rja_d6', 'rja_d7', 'rja_d8'], right: ['rja_r0', 'rja_r1', 'rja_r2', 'rja_r3', 'rja_r4', 'rja_r5', 'rja_r6', 'rja_r7', 'rja_r8'] },
                swordAttackW: [0.8, 0.8, 0.9, 1.1, 0.7, 0.7, 0.8, 1.6, 1.8], swordAttackFrames: 40, swordImpact: 0.52 } // per-frame weights; ~0.67s; the blow lands as the arc completes
        };
        const heroHD = {
            outfit: (() => { try { const o = localStorage.getItem('bosom-outfit-v2'); return HERO_OUTFITS[o] ? o : DEFAULT_OUTFIT; } catch (e) { return DEFAULT_OUTFIT; } })(),
            ready: false, img: null, req: null, phase: 0, lastT: 0, moveUntil: 0, lastSide: 'right',
            active() { return FX_GL.ok && this.ready; },
            setOutfit(id) { this.outfit = id; try { localStorage.setItem('bosom-outfit-v2', id); } catch (e) {} refreshOutfitUI(); },
            refH(o) { // self-calibrating scale: every outfit is normalized off its own idle frame's native pixel height,
                // instead of assuming every sprite sheet was drawn at the same source resolution (a mismatch here is
                // what makes a whole outfit render too big or too small relative to the others).
                if (o._refH) return o._refH;
                const n = (o.idle && (o.idle.down || o.idle.right || o.idle.up)) || null, f = n && HERO_FRAMES[n];
                return o._refH = (f ? f[3] : 88);
            },
            pick() { // which frame to show right now: { name, flip, bob, rot, sx, sy, piv, view, p }
                const o0 = HERO_OUTFITS[this.outfit], o = o0.drawn && COMBAT.on ? (o0._drawnO || (o0._drawnO = Object.assign({}, o0, o0.drawn))) : o0, now = performance.now();
                let d8 = camDir(hero.face8 || hero.dir || 'down', true), dir = cardinalOf(d8), side = dir === 'left' || dir === 'right';
                if (side && this.lastSide && this.lastSide !== dir && actionTimer <= 0) { this.turnUntil = now + 120; this.turnVia = String(this.prevD8 || '').startsWith('up') ? 'up' : 'down'; } // reversing: turn through the front instead of snapping to the mirror
                this.prevD8 = d8;
                if (now < (this.turnUntil || 0)) { if (side) this.lastSide = dir; d8 = this.turnVia; dir = d8; side = false; }
                const jq0 = jumpTimer > 0 ? Math.min(1, Math.max(0, ((1 - jumpTimer / JUMP_FRAMES) - 0.1) / 0.78)) : 0, jumpLift = jumpTimer > 0 ? Math.sin(jq0 * Math.PI) * 9 : 0; // crouch first, then the arc
                const dt = Math.min(100, now - (this.lastT || now)); this.lastT = now;
                if (player.isMoving) this.moveUntil = now + 120;
                const moving = now < this.moveUntil, rolling = rollAnim > 0, running = rolling || !!player.isRunning;
                // cycle progress 0..1 runs on time, not on frame count, so a 6-frame and an 8-frame cycle take the same stride time
                this.cyc = moving ? (this.cyc || 0) + dt / (running ? HERO_RUN_CYCLE_MS : HERO_WALK_CYCLE_MS) : 0;
                const p = this.cyc % 1; this.phase = p;
                if (side) this.lastSide = dir;
                if (HORSE.mounted) return horseRidePose(d8, moving, !!player.isRunning, dt, now);
                if (POUCH.state) return pouchPose(now);
                const at = (list, q) => list[Math.min(list.length - 1, Math.floor(q * list.length))];
                if (rolling) return this.rollPose(o, d8, 1 - rollAnim / ROLL_ANIM_FRAMES);
                if (jumpTimer > 0 && !String(d8).startsWith('up') && !(equippedItem === 'axe' && o.axeIdle)) { // the hop: its own frames where the sheet has them
                    const jq = 1 - jumpTimer / JUMP_FRAMES, jf = heroLookup(o.jump, d8);
                    if (jf && jf.v.length === 5) return { name: jf.v[jq < 0.12 ? 0 : jq < 0.35 ? 1 : jq < 0.65 ? 2 : jq < 0.85 ? 3 : 4], flip: jf.flip, bob: jumpLift * 0.6, rot: 0, view: jf.key, p, jumping: true };
                }
                const atkTbl = equippedItem === 'axe' ? o.attack : equippedItem === 'sword' ? o.swordAttack : null, atk = atkTbl && actionTimer > 0 && !(String(d8).startsWith('up') && !atkTbl.up) ? heroLookup(atkTbl, d8) : null;
                if (atk) { // the axe swing, in whichever of the 4 views he faces (diagonals use the side swing)
                    const aq = 1 - actionTimer / actionTotal, Wt = equippedItem === 'sword' && o.swordAttackW && o.swordAttackW.length === atk.v.length ? o.swordAttackW : null;
                    let nm, fl = atk.flip;
                    if (Wt) { const tot = Wt.reduce((a, b) => a + b, 0); let acc = 0, ix = Wt.length - 1; for (let i = 0; i < Wt.length; i++) { acc += Wt[i] / tot; if (aq < acc) { ix = i; break; } } nm = atk.v[ix]; }
                    else nm = at(atk.v, aq); if (nm.endsWith('~')) { nm = nm.slice(0, -1); fl = !fl; }
                    return { name: nm, flip: fl, bob: jumpLift, rot: 0, attacking: true, view: atk.key, p };
                }
                if (side && o.punch && actionTimer > 0 && equippedItem === 'none') { // bare-fist jab when no tool is equipped
                    return { name: at(o.punch, 1 - actionTimer / ACTION_FRAMES), flip: dir === 'left', bob: jumpLift, rot: 0, attacking: true, view: 'right', p };
                }
                // holding the axe (idle or moving): the axe is baked into this pose, so it stays glued to his hand
                const ax = equippedItem === 'axe' ? heroLookup(o.axeIdle, d8) : equippedItem === 'sword' ? heroLookup(o.swordIdle, d8) : null;
                if (ax && HERO_FRAMES[ax.v]) {
                    const ar = moving ? heroLookup(equippedItem === 'sword' ? o.swordRun : o.axeRun, d8) : null;
                    if (ar && ar.v.length) { let nm = at(ar.v, p), fl = ar.flip; if (nm.endsWith('~')) { nm = nm.slice(0, -1); fl = !fl; } return { name: nm, flip: fl, bob: jumpLift, rot: 0, holding: true, view: ar.key, p, moving }; }
                    const w = moving ? Math.sin(p * Math.PI * 2) : 0;
                    return { name: ax.v, flip: ax.flip, bob: (moving ? Math.abs(w) * 1.1 : Math.sin(now / 420) * 0.25) + jumpLift, rot: moving ? w * 0.05 : 0, holding: true, view: ax.key, p };
                }
                let name = null, flip = false, framed = false, view = dir;
                const cyc = (running && heroLookup(o.run, d8)) || heroLookup(o.walk, d8);
                if (moving && cyc && cyc.v.length) {
                    name = at(cyc.v, p); flip = cyc.flip; view = cyc.key; framed = true;
                    if (name.endsWith('~')) { name = name.slice(0, -1); flip = !flip; }
                } else {
                    const id = heroLookup(o.idle, d8);
                    if (id) { name = id.v; flip = id.flip; view = id.key; }
                    else { name = o.idle.down || o.idle.right; flip = !o.idle.down && this.lastSide === 'left'; view = o.idle.down ? 'down' : 'right'; } // only one view: face the way he last turned
                }
                let bob = 0, rot = 0;
                if (moving && !framed) { const w = Math.sin(p * Math.PI * 2); bob = Math.abs(w) * 1.1; rot = w * 0.05; } // outfits without walk frames rock and bounce
                else if (!moving) bob = Math.sin(now / 420) * 0.25;                                                     // gentle breathing
                return { name, flip, bob: bob + jumpLift, rot, view, p, moving };
            },
            rollPose(o, d8, q) { // the tumble. Uses roll frames when the outfit has them; otherwise a stand-in built from the run frames.
                const own = heroLookup(o.roll, d8);
                if (own && own.v.length) return { name: own.v[Math.min(own.v.length - 1, Math.floor(q * own.v.length))], flip: own.flip, bob: 0, rot: 0, view: own.key, p: q, rolling: true, drawnRoll: true };
                const cyc = heroLookup(o.run, d8) || heroLookup(o.walk, d8), id = heroLookup(o.idle, d8) || { v: o.idle.down || o.idle.right, flip: false, key: 'down' };
                const base = cyc && cyc.v.length ? cyc : { v: [id.v], flip: id.flip, key: id.key };
                let name = base.v[Math.floor(q * 3 * base.v.length) % base.v.length], flip = base.flip;
                if (name.endsWith('~')) { name = name.slice(0, -1); flip = !flip; }
                const e = Math.sin(Math.PI * q), dir = cardinalOf(d8);
                if (dir === 'left' || dir === 'right') { // side and diagonals: one full forward turn about the body's middle, curled up
                    const sgn = dir === 'right' ? 1 : -1;
                    return { name, flip, bob: e * 1.5, rot: sgn * q * Math.PI * 2, sx: 1 + e * 0.12, sy: 1 - e * 0.3, piv: 0.45, view: base.key, p: q, rolling: true };
                }
                // toward or away from the camera: a somersault read as the body tucking, flipping over and standing back up
                const c = Math.cos(Math.PI * 2 * q), sy = Math.sign(c || 1) * Math.max(0.3, Math.abs(c));
                return { name, flip, bob: e * 1.5, rot: 0, sx: 1 + e * 0.15, sy, piv: 0.45, view: base.key, p: q, rolling: true };
            },
            request(x, y) { // called instead of drawing the small pixel hero: remember where the feet are on screen and draw a contact shadow
                const m = ctx.getTransform(), fx = x + 8, fy = y + 15.5;
                this.req = { x: m.a * fx + m.c * fy + m.e, y: m.b * fx + m.d * fy + m.f, s: m.a };
                ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.beginPath(); ctx.ellipse(fx, fy, HORSE.mounted ? 12 : 6.5, HORSE.mounted ? 3 : 2.2, 0, 0, 7); ctx.fill();
                const dr = hero.dir, prog = 1 - actionTimer / ACTION_FRAMES; // a white slash arc at the end of the swing
                if (actionTimer > 0 && equippedItem === 'axe' && HERO_OUTFITS[this.outfit].attack && (dr === 'left' || dr === 'right') && prog > 0.5) {
                    const sg = dr === 'right' ? 1 : -1;
                    ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 * (1 - (prog - 0.5) / 0.5)).toFixed(2) + ')'; ctx.lineWidth = 2; ctx.beginPath();
                    ctx.arc(fx + sg * 3, fy - 12, 11, sg > 0 ? -1.0 : Math.PI - 0.6, sg > 0 ? 0.6 : Math.PI + 1.0); ctx.stroke();
                }
            },
            drawPreview(c) { // the START menu preview
                const o = HERO_OUTFITS[this.outfit], f = HERO_FRAMES[o.idle.down || o.idle.right] || HERO_FRAMES[Object.values(o.idle)[0]], k = f ? 56 / f[3] : 1;
                c.imageSmoothingEnabled = false; c.drawImage(this.img, f[0], f[1], f[2], f[3], (64 - f[2] * k) / 2, 4, f[2] * k, f[3] * k);
            }
        };
        function toggleOutfit() {
            if (!heroHD.active()) { showFluidMessage('Outfits need WebGL on this device.'); return; }
            const ids = Object.keys(HERO_OUTFITS); heroHD.setOutfit(ids[(ids.indexOf(heroHD.outfit) + 1) % ids.length]); audio.playSelect();
        }
        document.addEventListener('DOMContentLoaded', refreshOutfitUI);
        function drawHeroTool(c, dir, isActioning, tool) { // the held tool, drawn small and placed over the hero by the WebGL layer (same shapes as the pixel hero)
            c.clearRect(0, 0, 128, 128); c.save(); c.scale(4, 4); c.translate(8, 8);
            let tx = 0, ty = 0;
            if (dir === 'down') { tx = 12; ty = isActioning ? 12 : 6; } else if (dir === 'up') { tx = 2; ty = isActioning ? 0 : 4; }
            else if (dir === 'left') { tx = isActioning ? -4 : 0; ty = 8; } else { tx = isActioning ? 16 : 12; ty = 8; }
            if (tool === 'axe') {
                const f = HERO_FRAMES.tool_axe;
                if (f && heroHD.img) { // the axe art, gripped at the hand and pointing the way he faces
                    const ang = dir === 'down' ? 0 : dir === 'up' ? Math.PI : dir === 'left' ? Math.PI / 2 : -Math.PI / 2, len = 12, wid = len * f[2] / f[3];
                    c.save(); c.translate(tx + 2, ty + 1); c.rotate(ang); c.imageSmoothingEnabled = true;
                    c.drawImage(heroHD.img, f[0], f[1], f[2], f[3], -wid / 2, 0, wid, len); c.restore();
                } else {
                    c.fillStyle = '#cbd5e1'; c.fillRect(tx, ty, 4, 4); c.fillStyle = '#78350f';
                    if (dir === 'down') c.fillRect(tx + 1, ty + 2, 2, 6); else if (dir === 'up') c.fillRect(tx + 1, ty - 4, 2, 6);
                    else if (dir === 'left') c.fillRect(tx + 2, ty + 1, 6, 2); else if (tx >= 12) c.fillRect(tx - 4, ty + 1, 6, 2);
                }
            } else if (tool === 'torch') {
                c.fillStyle = '#78350f'; c.fillRect(tx, ty, 3, 6); c.fillStyle = '#f97316'; c.fillRect(tx - 1, ty - 4, 5, 5); c.fillStyle = '#fef08a'; c.fillRect(tx, ty - 3, 3, 3);
            } else if (tool === 'sword') { // outfits without baked sword poses: a small blade in the hand
                const ang = dir === 'down' ? 0 : dir === 'up' ? Math.PI : dir === 'left' ? Math.PI / 2 : -Math.PI / 2;
                c.save(); c.translate(tx + 2, ty + 1); c.rotate(ang + (isActioning ? 0.9 : 0));
                c.fillStyle = '#5b3a22'; c.fillRect(-0.4, -0.6, 0.8, 1.6); c.fillStyle = '#b45309'; c.fillRect(-1.4, 0.9, 2.8, 0.6);
                c.fillStyle = '#e2e8f0'; c.fillRect(-0.55, 1.5, 1.1, 4.6); c.fillStyle = '#94a3b8'; c.fillRect(-0.12, 1.5, 0.24, 4.6); c.restore();
            } else if (tool === 'rope') {
                c.strokeStyle = '#7c4f2c'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(tx + 2.5, ty + 2.5, 3, 2.4, 0, 0, 7); c.stroke();
                c.strokeStyle = '#c8a26b'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(tx + 2.5, ty + 2.5, 3, 2.4, 0, 3.4, 5.8); c.stroke();
                if (isActioning) { c.strokeStyle = '#a07845'; c.lineWidth = 0.9; c.beginPath(); c.arc(tx + 2.5, ty - 5, 5, 0, 7); c.stroke(); } // the loop, swung overhead
            } else if (tool === 'lens') {
                c.fillStyle = '#334155'; c.fillRect(tx, ty, 5, 5); c.fillStyle = '#38bdf8'; c.fillRect(tx + 1, ty + 1, 3, 3);
            }
            c.restore();
        }



